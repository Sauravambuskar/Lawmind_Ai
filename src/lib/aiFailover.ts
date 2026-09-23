/**
 * AI Failover — cooldown registry (circuit breaker)
 *
 * Problem this solves: when a key hits its rate limit, the old failover chain
 * retried that same key on *every* subsequent request — burning a wasted call
 * and adding latency each time before moving on.
 *
 * Here, a key that fails is put in cooldown and skipped entirely until it is
 * likely to work again. Cooldowns persist in localStorage, so a page refresh
 * does not start hammering a rate-limited key all over again.
 */

export type FailureKind =
  | 'rate_limit'   // 429 — key is throttled, comes back on its own
  | 'auth'         // 401/403 — key is bad/revoked
  | 'model'        // 404 / decommissioned — model name wrong for this provider
  | 'server'       // 5xx — provider-side outage
  | 'timeout'      // request took too long
  | 'network'      // fetch failed outright (DNS, offline, CORS)
  | 'bad_request'; // 4xx caused by our payload — not the key's fault

/** How long to sit out, per failure kind. Escalates on repeated failures. */
const BASE_COOLDOWN_MS: Record<FailureKind, number> = {
  rate_limit: 60_000,      // 1 min (overridden by Retry-After when provided)
  auth: 900_000,           // 15 min — key is probably dead, stop wasting calls
  model: 1_800_000,        // 30 min — misconfigured model, needs a human
  server: 30_000,          // 30 s
  timeout: 30_000,
  network: 20_000,
  bad_request: 0,          // our payload is wrong; it will fail everywhere
};

/** Cap on escalation: 2^3 = 8x the base at most. */
const MAX_ESCALATION = 8;

const STORAGE_KEY = 'lawmind_ai_cooldowns';

export interface CooldownEntry {
  id: string;
  until: number;      // epoch ms
  kind: FailureKind;
  reason: string;
  failures: number;   // consecutive failures — drives escalating backoff
}

type CooldownMap = Record<string, CooldownEntry>;

function load(): CooldownMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CooldownMap;
  } catch {
    /* corrupt or unavailable storage — treat as empty */
  }
  return {};
}

function save(map: CooldownMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full or blocked — cooldowns just won't survive reload */
  }
}

/**
 * Stable id for a config. Includes a short key fingerprint so two keys on the
 * same provider+model cool down independently — the whole point of extra keys.
 * Never stores the key itself.
 */
export function configId(c: { provider: string; model: string; apiKey: string }): string {
  const fp = c.apiKey ? c.apiKey.slice(-6) : 'nokey';
  return `${c.provider}:${c.model}:${fp}`;
}

/** ms until this config is usable again; 0 means available now. */
export function cooldownRemaining(id: string): number {
  const entry = load()[id];
  if (!entry) return 0;
  return Math.max(0, entry.until - Date.now());
}

export function isAvailable(id: string): boolean {
  return cooldownRemaining(id) === 0;
}

/** Map an HTTP status + message onto a failure kind. */
export function classifyFailure(status: number | undefined, message: string): FailureKind {
  const m = (message || '').toLowerCase();

  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'model';
  if (status !== undefined && status >= 500) return 'server';

  // Some providers return 400 for a retired model rather than 404.
  if (m.includes('decommissioned') || m.includes('model_not_found') || m.includes('does not exist')) {
    return 'model';
  }
  if (m.includes('rate') || m.includes('quota') || m.includes('too many requests')) return 'rate_limit';
  if (m.includes('api key') || m.includes('unauthorized') || m.includes('invalid_api_key')) return 'auth';
  if (m.includes('timeout') || m.includes('timed out') || m.includes('aborted')) return 'timeout';
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'network';
  if (status !== undefined && status >= 400) return 'bad_request';

  return 'network';
}

/**
 * Record a failure and put the config in cooldown.
 * `retryAfterMs` (from a Retry-After header) always wins when present.
 */
export function markFailure(
  id: string,
  kind: FailureKind,
  reason: string,
  retryAfterMs?: number,
): void {
  const map = load();
  const prev = map[id];
  const failures = (prev?.failures ?? 0) + 1;

  const base = BASE_COOLDOWN_MS[kind];
  if (base === 0 && retryAfterMs === undefined) {
    // bad_request — the key is fine, don't sideline it
    return;
  }

  const escalation = Math.min(2 ** (failures - 1), MAX_ESCALATION);
  const duration = retryAfterMs ?? base * escalation;

  map[id] = {
    id,
    until: Date.now() + duration,
    kind,
    reason: reason.slice(0, 200),
    failures,
  };
  save(map);
}

/** Clear a config's cooldown and failure streak after a successful call. */
export function markSuccess(id: string): void {
  const map = load();
  if (map[id]) {
    delete map[id];
    save(map);
  }
}

/** All cooldowns that are still in effect (expired ones are pruned). */
export function getCooldowns(): CooldownEntry[] {
  const map = load();
  const now = Date.now();
  let changed = false;

  for (const [id, entry] of Object.entries(map)) {
    if (entry.until <= now) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) save(map);

  return Object.values(map).sort((a, b) => a.until - b.until);
}

export function clearCooldown(id: string): void {
  const map = load();
  if (map[id]) {
    delete map[id];
    save(map);
  }
}

export function clearAllCooldowns(): void {
  save({});
}

const ROTATION_KEY = 'lawmind_ai_rotation';

/**
 * Round-robin cursor.
 *
 * Spreading requests across a provider's keys is what actually multiplies
 * throughput. A chain that always starts at key #1 puts the entire load on
 * key #1 and only touches the spares after it has already failed — so six
 * keys still give you one key's worth of rate limit. Rotating the starting
 * point gives you six.
 */
export function nextRotation(): number {
  try {
    const n = (Number(localStorage.getItem(ROTATION_KEY)) || 0) + 1;
    localStorage.setItem(ROTATION_KEY, String(n % 1_000_000));
    return n;
  } catch {
    // Storage blocked — random start still spreads load across a session.
    return Math.floor(Math.random() * 1000);
  }
}

/** Human-readable remaining time, e.g. "42s" or "12m". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'ready';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.ceil(m / 60)}h`;
}

export const FAILURE_LABEL: Record<FailureKind, string> = {
  rate_limit: 'Rate limited',
  auth: 'Bad API key',
  model: 'Model unavailable',
  server: 'Provider down',
  timeout: 'Timed out',
  network: 'Network error',
  bad_request: 'Request rejected',
};
