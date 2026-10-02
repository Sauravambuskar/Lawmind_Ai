"""Generate static Hindi guide narration for the CRM.

Install with: python -m pip install edge-tts
Run with:     python scripts/generate-guide-audio.py
"""

import argparse
import asyncio
import json
import re
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "components" / "GuideButton.tsx"
OUTPUT = ROOT / "public" / "audio" / "guide"
DEVANAGARI = re.compile(r"[\u0900-\u097f]")
HINDI_DESCRIPTION = re.compile(r'hindiDescription:\s*"((?:\\.|[^"\\])*)"')
BILINGUAL_HINDI = re.compile(
    r'bilingual\(\s*"(?:\\.|[^"\\])*"\s*,\s*"((?:\\.|[^"\\])*)"',
    re.DOTALL,
)


def decode_typescript_string(value: str) -> str:
    return json.loads(f'"{value}"')


def audio_id(text: str) -> str:
    value = 0x811C9DC5
    for character in text:
        value ^= ord(character)
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"{value:08x}"


def collect_narration() -> dict[str, str]:
    source = SOURCE.read_text(encoding="utf-8")
    matches = HINDI_DESCRIPTION.findall(source) + BILINGUAL_HINDI.findall(source)
    narration = {}
    for match in matches:
        text = decode_typescript_string(match).strip()
        if DEVANAGARI.search(text):
            narration[audio_id(text)] = text
    return narration


async def generate_one(identifier: str, text: str, voice: str, semaphore: asyncio.Semaphore, force: bool) -> bool:
    destination = OUTPUT / f"{identifier}.mp3"
    if destination.exists() and destination.stat().st_size > 0 and not force:
        return False
    async with semaphore:
        communicator = edge_tts.Communicate(text=text, voice=voice, rate="-5%", volume="+0%", pitch="+0Hz")
        await communicator.save(str(destination))
    return True


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate bundled Hindi guide narration")
    parser.add_argument("--voice", default="hi-IN-SwaraNeural")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    narration = collect_narration()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(3)
    generated = await asyncio.gather(*(
        generate_one(identifier, text, args.voice, semaphore, args.force)
        for identifier, text in narration.items()
    ))
    manifest = {
        "voice": args.voice,
        "format": "audio/mpeg",
        "items": {identifier: {"text": text, "file": f"{identifier}.mp3"} for identifier, text in sorted(narration.items())},
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guide audio ready: {sum(generated)} generated, {len(narration) - sum(generated)} unchanged, {len(narration)} total")


if __name__ == "__main__":
    asyncio.run(main())
