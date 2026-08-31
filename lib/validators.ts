import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required").max(200),
  industry: z.string().trim().min(2, "Industry is required").max(200),
  location: z.string().trim().min(2, "Location is required").max(200),
  requirement: z.string().trim().min(5, "Lead requirement is required").max(1000),
  target_count: z.coerce.number().int().min(1, "At least 1 lead").max(50, "Maximum 50 leads per campaign"),
});

export type CreateCampaignParsed = z.infer<typeof createCampaignSchema>;

/** Basic guard against obviously unsafe/non-http(s) targets before we ever fetch a URL. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
