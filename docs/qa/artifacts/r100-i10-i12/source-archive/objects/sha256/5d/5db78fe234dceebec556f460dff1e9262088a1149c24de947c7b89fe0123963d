/** Presentation-only history. It is deliberately outside game records and
 * never consumes a gameplay random stream. Call choose only when showing text. */
export interface NarrationRow { readonly id: string; readonly text: string }
export interface NarrationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface ScopeMemory { used: string[]; lastText: string }
interface SavedMemory { version: 1; scopes: Record<string, ScopeMemory>; lastText: string }
export const NARRATION_STORAGE_KEY = 'coh.atmosphere.v1';
const MAX_SCOPES = 256;
const MAX_ROWS = 2048;
const emptyMemory = (): SavedMemory => ({ version: 1, scopes: Object.create(null) as Record<string, ScopeMemory>, lastText: '' });
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 256;

function cosmeticRandom(): () => number {
  // Own stream: even legacy gameplay using Math.random must not be advanced by prose.
  let seed = Date.now() >>> 0;
  try { seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!; } catch { /* Clock seed is sufficient for cosmetic variety. */ }
  seed ||= 0x9e3779b9;
  return () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
}

function restore(raw: string | null): SavedMemory {
  if (!raw || raw.length > 1_000_000) return emptyMemory();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return emptyMemory();
    const saved = value as Partial<SavedMemory>;
    if (saved.version !== 1 || !text(saved.lastText) || !saved.scopes || typeof saved.scopes !== 'object'
      || Array.isArray(saved.scopes) || Object.keys(saved.scopes).length > MAX_SCOPES) return emptyMemory();
    const result = emptyMemory(); result.lastText = saved.lastText;
    for (const [scope, record] of Object.entries(saved.scopes)) {
      if (!scope || scope.length > 256 || !record || typeof record !== 'object' || !text(record.lastText)
        || !Array.isArray(record.used) || record.used.length > MAX_ROWS || !record.used.every(text)
        || new Set(record.used).size !== record.used.length) return emptyMemory();
      result.scopes[scope] = { used: [...record.used], lastText: record.lastText };
    }
    return result;
  } catch { return emptyMemory(); }
}

/** Storage and cosmetic randomness are injected for deterministic tests. */
export class NarrationMemory {
  private readonly state: SavedMemory;
  constructor(private readonly storage: NarrationStorage | null = null, private readonly random: () => number = cosmeticRandom()) {
    let raw: string | null = null;
    try { raw = storage?.getItem(NARRATION_STORAGE_KEY) ?? null; } catch { /* Private browsing or disabled storage: retain session memory. */ }
    this.state = restore(raw);
  }

  choose<T extends NarrationRow>(scope: string, rows: readonly T[]): T {
    if (!scope || scope.length > 256 || !rows.length || rows.length > MAX_ROWS) throw new Error('Narration needs a stable scope and a nonempty bounded pool.');
    const ids = new Set(rows.map(row => row.id));
    if (ids.size !== rows.length || rows.some(row => !row.id || row.id.length > 256 || !text(row.text) || !row.text.trim())) {
      throw new Error(`Invalid narration rows for ${scope}`);
    }
    const previous = this.state.scopes[scope] ?? { used: [], lastText: '' };
    // Author edits may remove entries or expand a pool. Keep surviving usage;
    // newly added lines become eligible without prematurely restarting a cycle.
    let used = previous.used.filter(id => ids.has(id));
    let remaining = rows.filter(row => !used.includes(row.id));
    if (!remaining.length) { used = []; remaining = [...rows]; }
    const avoidBoth = remaining.filter(row => row.text !== this.state.lastText && row.text !== previous.lastText);
    const avoidGlobal = remaining.filter(row => row.text !== this.state.lastText);
    const avoidScope = remaining.filter(row => row.text !== previous.lastText);
    const candidates = avoidBoth.length ? avoidBoth : avoidGlobal.length ? avoidGlobal : avoidScope.length ? avoidScope : remaining;
    const value = this.random();
    const index = Math.min(candidates.length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * candidates.length)));
    const selected = candidates[index]!;
    // Scope insertion order is an LRU for accidental unbounded caller scopes.
    // Correct callers use semantic pools, not per-host/per-frame identities.
    delete this.state.scopes[scope];
    this.state.scopes[scope] = { used: [...used, selected.id], lastText: selected.text };
    this.state.lastText = selected.text;
    while (Object.keys(this.state.scopes).length > MAX_SCOPES) delete this.state.scopes[Object.keys(this.state.scopes)[0]!];
    try { this.storage?.setItem(NARRATION_STORAGE_KEY, JSON.stringify(this.state)); } catch { /* A refused write never prevents presentation or resets this session's bag. */ }
    return selected;
  }
}
