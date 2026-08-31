import type { LeadTemperature } from "@/types/lead";

/**
 * Transparent, shared scoring rubric. The AI (lib/groq.ts) is instructed to apply this
 * exact rubric and show its reasoning; these helpers keep the UI and the temperature
 * classification consistent with what the model was told to do (a single source of truth,
 * not a second scorer overriding the AI's judgement).
 */
export const SCORING_FACTORS: { label: string; points: number }[] = [
  { label: "Outdated-looking website", points: 20 },
  { label: "Poor or unknown mobile experience", points: 20 },
  { label: "No clear call-to-action", points: 10 },
  { label: "No online booking or ordering", points: 10 },
  { label: "Poor or thin SEO/content", points: 10 },
  { label: "No WhatsApp / no contact form", points: 10 },
  { label: "Old-looking design", points: 10 },
  { label: "Business appears active", points: 10 },
];

export const SCORE_MAX = 100;

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  return "cold";
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(SCORE_MAX, Math.round(n)));
}

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const TEMPERATURE_RANGE: Record<LeadTemperature, string> = {
  hot: "80-100",
  warm: "60-79",
  cold: "0-59",
};
