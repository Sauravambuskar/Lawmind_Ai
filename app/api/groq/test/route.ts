import { NextResponse } from "next/server";
import { checkGroqHealth } from "@/lib/groq";

export async function GET() {
  const result = await checkGroqHealth();
  return NextResponse.json(result);
}
