import { supabase } from "@/integrations/supabase/client";

interface TinyFishConfig {
  apiKey: string;
  baseUrl: string;
}

interface TinyFishRequest {
  url: string;
  goal: string;
  output_schema?: Record<string, unknown>;
  max_steps?: number;
  max_duration_seconds?: number;
}

interface TinyFishResponse {
  success: boolean;
  data?: any;
  error?: string;
  steps?: number;
  duration_ms?: number;
}

/**
 * Load TinyFish API key from ai_config.
 */
export async function loadTinyFishConfig(): Promise<TinyFishConfig | null> {
  const { data, error } = await supabase
    .from("ai_config")
    .select("api_key, base_url")
    .eq("provider", "tinyfish")
    .eq("is_active", true)
    .single();

  if (error || !data?.api_key) return null;

  return {
    apiKey: data.api_key,
    baseUrl: data.base_url || "https://agent.tinyfish.ai/v1",
  };
}

/**
 * Execute a TinyFish web automation task using the /run/sync endpoint.
 * @param request The automation request
 * @returns The structured result or error
 */
export async function runTinyFishTask(
  request: TinyFishRequest,
): Promise<TinyFishResponse> {
  const config = await loadTinyFishConfig();
  if (!config) {
    return { success: false, error: "TinyFish not configured or disabled. Add your API key in AI Settings." };
  }

  const payload = {
    url: request.url,
    goal: request.goal,
    output_schema: request.output_schema,
    agent_config: {
      max_steps: request.max_steps ?? 50,
      max_duration_seconds: request.max_duration_seconds ?? 180,
    },
  };

  try {
    const res = await fetch(`${config.baseUrl}/run/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      return {
        success: false,
        error: errBody.message || `HTTP ${res.status}`,
      };
    }

    const result = await res.json();
    return {
      success: true,
      data: result.output || result,
      steps: result.steps_taken,
      duration_ms: result.duration_ms,
    };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

/**
 * Predefined legal research tasks
 */
export const LEGAL_RESEARCH_PRESETS = [
  {
    id: "indian_kanoon_search",
    label: "Search Indian Kanoon",
    description: "Find judgments related to a legal query",
    urlTemplate: "https://indiankanoon.org/search/?formInput=",
    goalTemplate: "Search for cases related to: {query}. Extract the top 5 results with case name, citation, court, year and a brief summary.",
    outputSchema: {
      type: "object" as const,
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              case_name: { type: "string" },
              citation: { type: "string" },
              court: { type: "string" },
              year: { type: "number" },
              summary: { type: "string" },
              url: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    id: "scconline_search",
    label: "Search SCC Online",
    description: "Find judgments on SCC Online (free tier)",
    urlTemplate: "https://www.scconline.com/search/search?q=",
    goalTemplate: "Search for: {query}. Extract case details (name, citation, court, date) from the first page of results.",
    outputSchema: {
      type: "object" as const,
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              citation: { type: "string" },
              court: { type: "string" },
              date: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    id: "ecourts_case_status",
    label: "eCourts Case Status",
    description: "Check case status on eCourts (requires CNR or case number)",
    urlTemplate: "https://services.ecourts.gov.in/ecourtindia_v6/",
    goalTemplate: "Navigate to the case status page. Enter CNR number: {query}. Extract the case status, last hearing date, next hearing date and order details.",
    outputSchema: {
      type: "object" as const,
      properties: {
        case_number: { type: "string" },
        status: { type: "string" },
        last_hearing_date: { type: "string" },
        next_hearing_date: { type: "string" },
        orders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              order_text: { type: "string" },
            },
          },
        },
      },
    },
  },
];
