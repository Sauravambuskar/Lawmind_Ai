export type CampaignStatus =
  | "pending"
  | "searching"
  | "scraping"
  | "analyzing"
  | "completed"
  | "failed";

export interface Campaign {
  id: string;
  name: string;
  industry: string;
  location: string;
  requirement: string;
  target_count: number;
  status: CampaignStatus;
  progress_message: string | null;
  progress_current: number;
  progress_total: number;
  demo_mode: 0 | 1;
  error: string | null;
  created_at: string;
}

export interface CreateCampaignInput {
  name: string;
  industry: string;
  location: string;
  requirement: string;
  target_count: number;
}
