import { NextResponse } from "next/server";
import { checkFirecrawlHealth, isFirecrawlConfigured } from "@/lib/firecrawl";
import { isGroqConfigured, getGroqModel } from "@/lib/groq";
import { getStats } from "@/lib/database";

export async function GET() {
  const firecrawl = isFirecrawlConfigured()
    ? await checkFirecrawlHealth()
    : { ok: false, message: "FIRECRAWL_API_URL is not set. Demo Mode will be used." };

  const groq = {
    ok: isGroqConfigured(),
    message: isGroqConfigured()
      ? `Groq API key detected (model: ${getGroqModel()}).`
      : "Groq API key is missing. Set GROQ_API_KEY in your environment.",
  };

  let database: { ok: boolean; message: string };
  try {
    getStats();
    database = { ok: true, message: "Database connected." };
  } catch (err) {
    database = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ firecrawl, groq, database });
}
