// ============================================================
// LAWMIND — MySQL/PHP Client (Supabase API compatible)
// Drop-in replacement for @supabase/supabase-js
// ============================================================

type AnyObj = Record<string, any>;
type Filter = { op: string; col: string; val: any };
type OrderSpec = { column: string; ascending: boolean };
type EmbedSpec = { table: string; as: string; fk: string; pk?: string; many?: boolean };

// ── Token + session storage ─────────────────────────────────
const TOKEN_KEY = 'lawmind.token';
const USER_KEY  = 'lawmind.user';

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(t: string | null): void {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
function getStoredUser(): any {
  try { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; } catch { return null; }
}
function setStoredUser(u: any): void {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}

// ── API base URL ────────────────────────────────────────────
function apiBase(): string {
  const cfg = (window as any).APP_CONFIG;
  return (cfg?.apiUrl || '/api').replace(/\/$/, '');
}

async function apiPost(path: string, body: any): Promise<any> {
  const token = getToken();
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) {
    return { error: data.error || data.message || 'Request failed', status: res.status, data: null };
  }
  return data;
}

async function apiGet(path: string): Promise<any> {
  const token = getToken();
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) return { error: data.error || data.message || 'Request failed', status: res.status, data: null };
  return data;
}

// ── Auth state change listeners ─────────────────────────────
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';
const authListeners: Array<(event: AuthEvent, session: any) => void> = [];
function emit(event: AuthEvent, session: any) {
  authListeners.forEach(cb => { try { cb(event, session); } catch {} });
}

function sessionFromToken(): any {
  const token = getToken();
  const user  = getStoredUser();
  if (!token || !user) return null;
  return { access_token: token, refresh_token: token, token_type: 'bearer', user };
}

// ── Parse Supabase-style select string into columns + embeds ─
// Examples:
//   '*'
//   'id, name, email'
//   '*, clients(name, email), advocates(name)'
//   '*, hearings!case_id(*)'        — explicit fk
function parseSelect(sel?: string): { columns: string; embeds: EmbedSpec[] } {
  if (!sel || sel === '*') return { columns: '*', embeds: [] };
  const embeds: EmbedSpec[] = [];
  // Replace nested(...) with placeholders so split-by-comma works at top level
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  const colsOut: string[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:!([a-zA-Z_][a-zA-Z0-9_]*))?\s*\(([^)]*)\)$/);
    if (m) {
      const relTable = m[1];
      const explicitFk = m[2];
      // Convention: foreign key is `${relTable_singular}_id` if not specified
      const fk = explicitFk || guessFk(relTable);
      embeds.push({ table: relTable, as: relTable, fk, pk: 'id', many: false });
    } else {
      colsOut.push(p);
    }
  }
  return { columns: colsOut.length ? colsOut.join(',') : '*', embeds };
}

function guessFk(relTable: string): string {
  // 'clients' → 'client_id', 'advocates' → 'advocate_id', 'cases' → 'case_id'
  const singular = relTable.endsWith('s') ? relTable.slice(0, -1) : relTable;
  return `${singular}_id`;
}

// ── Query Builder ───────────────────────────────────────────
class QueryBuilder<T = any> implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private filters: Filter[] = [];
  private orders: OrderSpec[] = [];
  private columns = '*';
  private embeds: EmbedSpec[] = [];
  private _limit?: number;
  private _offset?: number;
  private _single = false;
  private _maybeSingle = false;
  private _count: 'exact' | null = null;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private _returning = true;

  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: 'exact' | null }): this {
    const parsed = parseSelect(cols);
    this.columns = parsed.columns;
    this.embeds  = parsed.embeds;
    if (opts?.count) this._count = opts.count;
    return this;
  }

  insert(rows: any | any[]): this {
    this.action = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: any | any[]): this {
    // Treated like insert for now; on conflict the PHP layer will surface an error
    return this.insert(rows);
  }

  update(data: any): this {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(col: string, val: any): this    { this.filters.push({ op: 'eq', col, val }); return this; }
  neq(col: string, val: any): this   { this.filters.push({ op: 'neq', col, val }); return this; }
  gt(col: string, val: any): this    { this.filters.push({ op: 'gt', col, val }); return this; }
  gte(col: string, val: any): this   { this.filters.push({ op: 'gte', col, val }); return this; }
  lt(col: string, val: any): this    { this.filters.push({ op: 'lt', col, val }); return this; }
  lte(col: string, val: any): this   { this.filters.push({ op: 'lte', col, val }); return this; }
  like(col: string, val: string): this  { this.filters.push({ op: 'like', col, val }); return this; }
  ilike(col: string, val: string): this { this.filters.push({ op: 'ilike', col, val }); return this; }
  is(col: string, val: any): this    { this.filters.push({ op: 'is', col, val }); return this; }
  in(col: string, vals: any[]): this { this.filters.push({ op: 'in', col, val: vals }); return this; }
  match(criteria: AnyObj): this {
    for (const k in criteria) this.filters.push({ op: 'eq', col: k, val: criteria[k] });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this  { this._limit = n; return this; }
  range(from: number, to: number): this {
    this._offset = from;
    this._limit  = (to - from) + 1;
    return this;
  }

  single(): this      { this._single = true; return this; }
  maybeSingle(): this { this._maybeSingle = true; return this; }

  // Make this thenable so `await query` works
  then<TResult1 = any, TResult2 = never>(
    onFulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?:  ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled as any, onRejected as any);
  }

  private async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    const body: any = {
      action: this.action,
      filters: this.filters,
      order: this.orders,
      limit: this._limit,
      offset: this._offset,
      single: this._single,
      maybe_single: this._maybeSingle,
      count: this._count === 'exact',
      embed: this.embeds,
    };
    if (this.action === 'insert') body.rows = this.payload;
    if (this.action === 'update') body.data = this.payload;

    return apiPost(`/crud.php?table=${encodeURIComponent(this.table)}`, body);
  }
}

// ── Auth API ────────────────────────────────────────────────
const authApi = {
  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    const res = await apiPost('/auth/signup.php', {
      email, password, data: options?.data || {},
    });
    if (res.error) return { data: { user: null, session: null }, error: { message: res.error } };
    const { user, session } = res.data;
    setToken(session?.access_token || null);
    setStoredUser(user);
    emit('SIGNED_IN', session);
    return { data: { user, session }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await apiPost('/auth/login.php', { email, password });
    if (res.error) return { data: { user: null, session: null }, error: { message: res.error } };
    const { user, session } = res.data;
    setToken(session?.access_token || null);
    setStoredUser(user);
    emit('SIGNED_IN', session);
    return { data: { user, session }, error: null };
  },

  async signOut() {
    await apiPost('/auth/logout.php', {});
    setToken(null);
    setStoredUser(null);
    emit('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    return { data: { session: sessionFromToken() }, error: null };
  },

  async getUser() {
    const stored = getStoredUser();
    if (stored) return { data: { user: stored }, error: null };
    const res = await apiGet('/auth/me.php');
    const u = res?.data?.user || null;
    if (u) setStoredUser(u);
    return { data: { user: u }, error: null };
  },

  async updateUser(_attrs: any) {
    // Minimal implementation — accepts but no-ops for password/email changes in Phase 1
    return { data: { user: getStoredUser() }, error: null };
  },

  async resetPasswordForEmail(_email: string, _opts?: any) {
    return { data: null, error: { message: 'Password reset not implemented in MySQL build yet' } };
  },

  // Admin-only: create a new user without affecting the caller's session.
  async adminCreateUser(payload: { email: string; password: string; full_name?: string; role?: string }) {
    const res = await apiPost('/auth/admin_create_user.php', payload);
    if (res.error) return { data: null, error: { message: res.error } };
    return { data: res.data, error: null };
  },

  onAuthStateChange(cb: (event: AuthEvent, session: any) => void) {
    authListeners.push(cb);
    // Fire initial state asynchronously, like Supabase does
    setTimeout(() => cb('INITIAL_SESSION', sessionFromToken()), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = authListeners.indexOf(cb);
            if (i >= 0) authListeners.splice(i, 1);
          },
        },
      },
    };
  },
};

// ── Storage API ─────────────────────────────────────────────
function storageFrom(_bucket: string) {
  return {
    async upload(path: string, file: File | Blob, _opts?: any) {
      const form = new FormData();
      form.append('file', file as any);
      form.append('path', path);
      const token = getToken();
      const res = await fetch(`${apiBase()}/storage.php?action=upload`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
      });
      const json = await res.json().catch(() => ({ error: 'Bad response' }));
      if (!res.ok) return { data: null, error: { message: json.error || 'Upload failed' } };
      return { data: json.data, error: null };
    },

    getPublicUrl(path: string) {
      // Synchronous in Supabase; we just construct the URL locally
      const cfg = (window as any).APP_CONFIG;
      const base = cfg?.uploadUrl || '/uploads';
      return { data: { publicUrl: `${base}/${path}` } };
    },

    async createSignedUrl(path: string, _expiresIn: number) {
      const cfg = (window as any).APP_CONFIG;
      const base = cfg?.uploadUrl || '/uploads';
      return { data: { signedUrl: `${base}/${path}` }, error: null };
    },

    async remove(paths: string[]) {
      const res = await apiPost('/storage.php?action=remove', { paths });
      if (res.error) return { data: null, error: { message: res.error } };
      return { data: res.data, error: null };
    },
  };
}

// ── RPC ────────────────────────────────────────────────────
async function rpc(fn: string, args?: any) {
  return apiPost(`/rpc.php?fn=${encodeURIComponent(fn)}`, args || {});
}

// ── Channel (real-time stub) ───────────────────────────────
function channel(_name: string) {
  return {
    on(_event: string, _filter: any, _cb: any) { return this; },
    subscribe(_cb?: any) { return this; },
    unsubscribe() { return Promise.resolve('ok'); },
  };
}

// ── Public client ──────────────────────────────────────────
export const mysqlClient = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
  auth: authApi,
  storage: { from: storageFrom },
  rpc,
  channel,
  removeChannel: (_ch: any) => Promise.resolve('ok'),
  removeAllChannels: () => Promise.resolve(['ok']),
};

export type MySQLClient = typeof mysqlClient;
