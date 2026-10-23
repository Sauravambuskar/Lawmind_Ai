import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const assets = path.join(dist, "assets");
const KiB = 1024;

const budgets = {
  entryGzip: 250 * KiB,
  chunkGzip: 650 * KiB,
  cssGzip: 80 * KiB,
};

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(fullPath) : [fullPath];
  }));
  return files.flat();
}

const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
const entryMatch = indexHtml.match(/<script[^>]+src="([^"]+\.js)"/);
if (!entryMatch) throw new Error("Could not find the production entry script");

const entryPath = path.join(dist, entryMatch[1].replace(/^\//, ""));
const allAssets = (await filesIn(assets)).filter((file) => /\.(?:js|css)$/.test(file));
const failures = [];

for (const file of allAssets) {
  const contents = await readFile(file);
  const gzipBytes = gzipSync(contents).byteLength;
  const relative = path.relative(dist, file).replaceAll("\\", "/");
  const isEntry = path.resolve(file) === path.resolve(entryPath);
  const limit = file.endsWith(".css")
    ? budgets.cssGzip
    : isEntry
      ? budgets.entryGzip
      : budgets.chunkGzip;

  if (gzipBytes > limit) {
    failures.push(`${relative}: ${(gzipBytes / KiB).toFixed(1)} KiB gzip exceeds ${(limit / KiB).toFixed(0)} KiB`);
  }
}

const entryBytes = (await stat(entryPath)).size;
console.log(`Performance budget checked ${allAssets.length} assets; entry raw size ${(entryBytes / KiB).toFixed(1)} KiB.`);

if (failures.length) {
  console.error("Performance budget exceeded:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
