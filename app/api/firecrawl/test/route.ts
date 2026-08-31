import { NextResponse } from "next/server";
import { checkFirecrawlHealth } from "@/lib/firecrawl";

export async function GET() {
  const result = await checkFirecrawlHealth();
  return NextResponse.json(result);
}
