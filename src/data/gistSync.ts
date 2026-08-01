/**
 * Gist 数据同步 — 通过 GitHub Gist API 实现三端实时共享
 */

const GIST_CONFIG_KEY = 'a4paper_gist_config';
/** 硬编码 Gist ID，新浏览器没 Token 也能匿名拉取 */
const FALLBACK_GIST_ID = '3c75ec1e8065f834eeb1898adaa26899';
const SYNC_KEYS = [
  'a4paper_scanned_books',
  'a4paper_book_progress_v2',
  'a4paper_mastery',
  'a4paper_session_state',
  'a4paper_deepseek_api_key',
  'a4paper_phrases',
  'a4paper_reading_banks',
  'a4paper_api_key',
  'a4paper_learning_history',
  'a4paper_error_words',
  'a4paper_progress',
  'a4paper_gist_config',
];

interface GistConfig {
  gistId: string;
  lastSyncedAt: string;
  deviceId: string;
}

interface SyncPayload {
  _meta: { version: 2; lastUpdatedAt: string; deviceId: string };
  data: Record<string, unknown>;
}

function getStoredConfig(): GistConfig | null {
  try {
    const raw = localStorage.getItem(GIST_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGistConfig(gistId: string, lastSyncedAt: string, deviceId: string): void {
  localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify({ gistId, lastSyncedAt, deviceId }));
}

function generateDeviceId(): string {
  try {
    const nav = navigator as any;
    if (nav?.userAgentData?.platform) return `web-${nav.userAgentData.platform}-${Date.now()}`;
  } catch {}
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateDeviceId(): string {
  const config = getStoredConfig();
  return config?.deviceId ?? generateDeviceId();
}

const GITHUB_API = 'https://api.github.com';

async function githubFetch(url: string, token: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
}

interface GitHubGist {
  id: string;
  files: Record<string, { filename: string; content?: string; raw_url?: string; truncated?: boolean }>;
  description?: string;
  public: boolean;
}

async function readGistData(gistId: string, token: string): Promise<SyncPayload | null> {
  const res = await githubFetch(`${GITHUB_API}/gists/${gistId}`, token);
  if (!res.ok) return null;
  const gist: GitHubGist = await res.json();
  const file = gist.files?.['data.json'];
  if (!file?.content) return null;
  try { return JSON.parse(file.content) as SyncPayload; } catch { return null; }
}

/** 匿名读取 Gist（不需要 Token，仅限公开可读的 Gist） */
async function readGistDataAnonymous(gistId: string): Promise<SyncPayload | null> {
  const res = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!res.ok) return null;
  const gist: GitHubGist = await res.json();
  const file = gist.files?.['data.json'];
  if (!file?.content) return null;
  try { return JSON.parse(file.content) as SyncPayload; } catch { return null; }
}

async function createGist(token: string, payload: SyncPayload): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}/gists`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'A4 Paper — 多端同步数据',
      public: true,  // 公开 Gist：允许新浏览器匿名拉取，无需输入 Token 即可读
      files: { 'data.json': { content: JSON.stringify(payload, null, 2) } },
    }),
  });
  if (!res.ok) return null;
  const gist: GitHubGist = await res.json();
  return gist.id;
}

async function updateGist(gistId: string, token: string, payload: SyncPayload): Promise<boolean> {
  const res = await githubFetch(`${GITHUB_API}/gists/${gistId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ files: { 'data.json': { content: JSON.stringify(payload, null, 2) } } }),
  });
  return res.ok;
}

function packLocalData(deviceId: string): SyncPayload {
  const data: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    if (key === GIST_CONFIG_KEY) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
      }
    } catch {}
  }
  return { _meta: { version: 2, lastUpdatedAt: new Date().toISOString(), deviceId }, data };
}

function unpackRemoteData(payload: SyncPayload): { keys: string[]; timestamp: string; deviceId: string } {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(payload.data)) {
    if (key === GIST_CONFIG_KEY) continue;
    try { localStorage.setItem(key, JSON.stringify(value)); keys.push(key); } catch {}
  }
  return { keys, timestamp: payload._meta.lastUpdatedAt, deviceId: payload._meta.deviceId };
}

function isLocalEmpty(): boolean {
  for (const key of SYNC_KEYS) {
    if (key === GIST_CONFIG_KEY) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== '[]' && raw !== '{}' && raw !== '"') return false;
    } catch {}
  }
  return true;
}

export async function verifyToken(token: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) {
      if (res.status === 401) return { valid: false, error: 'Token 无效，请检查' };
      if (res.status === 403) return { valid: false, error: 'Token 被限流或权限不足' };
      return { valid: false, error: `API 错误: ${res.status}` };
    }
    const user = await res.json();
    return { valid: true, username: user.login };
  } catch (e) {
    return { valid: false, error: `网络错误: ${e instanceof Error ? e.message : '未知'}` };
  }
}

export function getGistStatus(): { connected: boolean; gistId?: string; lastSyncedAt?: string; deviceId?: string } {
  const config = getStoredConfig();
  return { connected: !!config?.gistId, gistId: config?.gistId, lastSyncedAt: config?.lastSyncedAt, deviceId: config?.deviceId };
}

export function disconnectGist(): void {
  localStorage.removeItem('a4paper_github_token');
}

export async function pullFromGist(token: string): Promise<{ pulled: boolean; pushed: boolean; keys?: string[]; error?: string; message: string }> {
  let config = getStoredConfig();
  const deviceId = getOrCreateDeviceId();

  try {
    if (!config?.gistId) {
      const res = await githubFetch(`${GITHUB_API}/gists?per_page=20`, token);
      if (res.ok) {
        const gists: GitHubGist[] = await res.json();
        const existing = gists.find(g => g.description === 'A4 Paper — 多端同步数据' && g.files?.['data.json']);
        if (existing) {
          saveGistConfig(existing.id, '', deviceId);
          config = getStoredConfig();
        }
      }
    }

    const cfg = config || getStoredConfig();
    if (!cfg?.gistId) {
      const gistId = await createGist(token, packLocalData(deviceId));
      if (!gistId) return { pulled: false, pushed: false, error: '创建 Gist 失败', message: '创建 Gist 失败' };
      saveGistConfig(gistId, new Date().toISOString(), deviceId);
      return { pulled: false, pushed: true, message: '已创建云端数据' };
    }

    const remote = await readGistData(cfg.gistId, token);
    const localEmpty = isLocalEmpty();
    // 是否首次连接此 Gist（没有过同步记录）
    const isFirstSync = !cfg.lastSyncedAt;

    if (!remote && localEmpty) {
      return { pulled: false, pushed: false, error: '远程数据为空', message: '无数据可同步' };
    }

    if (!remote) {
      // 远程没数据，上传本地
      const ok = await updateGist(cfg.gistId, token, packLocalData(deviceId));
      if (ok) { saveGistConfig(cfg.gistId, new Date().toISOString(), deviceId); return { pulled: false, pushed: true, message: '已上传本地数据' }; }
      return { pulled: false, pushed: false, error: '上传失败', message: '同步失败' };
    }

    if (localEmpty) {
      // 本地没数据，从云端恢复
      const result = unpackRemoteData(remote);
      saveGistConfig(cfg.gistId, new Date().toISOString(), deviceId);
      return { pulled: true, pushed: false, keys: result.keys, message: `已从云端恢复 ${result.keys.length} 项数据` };
    }

    // ★ 关键修复：首次连接且本地有数据 → 以本地为准，推送到云端
    if (isFirstSync) {
      const ok = await updateGist(cfg.gistId, token, packLocalData(deviceId));
      if (ok) {
        saveGistConfig(cfg.gistId, new Date().toISOString(), deviceId);
        return { pulled: false, pushed: true, message: `已将本地数据上传到云端` };
      }
      return { pulled: false, pushed: false, error: '上传本地数据失败', message: '同步失败，请重试' };
    }

    // 已有过同步记录：比较时间戳
    const remoteTime = new Date(remote._meta.lastUpdatedAt).getTime();
    const localTime = new Date(cfg.lastSyncedAt).getTime();

    if (remoteTime > localTime && remote._meta.deviceId !== deviceId) {
      const result = unpackRemoteData(remote);
      saveGistConfig(cfg.gistId, new Date().toISOString(), deviceId);
      return { pulled: true, pushed: false, keys: result.keys, message: `已同步云端最新数据 (${result.keys.length} 项)` };
    }

    // 本地比云端新（或云端是自己的数据）→ 推送本地
    if (localTime >= remoteTime || remote._meta.deviceId === deviceId) {
      const ok = await updateGist(cfg.gistId, token, packLocalData(deviceId));
      if (ok) {
        saveGistConfig(cfg.gistId, new Date().toISOString(), deviceId);
        return { pulled: false, pushed: true, message: '已将本地数据推送到云端' };
      }
    }

    return { pulled: false, pushed: false, message: '数据已是最新' };
  } catch (e) {
    return { pulled: false, pushed: false, error: e instanceof Error ? e.message : '未知错误', message: '同步失败' };
  }
}

/** 匿名拉取 Gist（无需 Token，仅读取不推送）。
 *  优先从 localStorage 取 gistId，没有则用硬编码的 FALLBACK_GIST_ID。
 *  仅在本地数据为空 或 远程更新且来源设备不同时恢复数据。
 */
export async function pullFromGistAnonymous(): Promise<{ pulled: boolean; keys?: string[]; error?: string; message: string }> {
  const config = getStoredConfig();
  const deviceId = getOrCreateDeviceId();
  const gistId = config?.gistId || FALLBACK_GIST_ID;

  try {
    const remote = await readGistDataAnonymous(gistId);
    if (!remote) {
      return { pulled: false, message: '远程数据为空，跳过同步' };
    }

    const localEmpty = isLocalEmpty();
    const remoteTime = new Date(remote._meta.lastUpdatedAt).getTime();
    const localTime = config?.lastSyncedAt ? new Date(config.lastSyncedAt).getTime() : 0;

    // 本地为空 → 直接恢复
    if (localEmpty) {
      const result = unpackRemoteData(remote);
      // 如果之前没有 config，写入 gistId 供后续使用
      if (!config?.gistId) {
        saveGistConfig(gistId, new Date().toISOString(), deviceId);
      } else {
        saveGistConfig(config.gistId, new Date().toISOString(), deviceId);
      }
      return { pulled: true, keys: result.keys, message: `已从云端恢复 ${result.keys.length} 项数据` };
    }

    // 远程更新 且 来源设备不同 → 拉取（避免覆盖自己刚 push 的）
    if (remoteTime > localTime && remote._meta.deviceId !== deviceId) {
      const result = unpackRemoteData(remote);
      saveGistConfig(gistId, new Date().toISOString(), deviceId);
      return { pulled: true, keys: result.keys, message: `已同步云端最新数据 (${result.keys.length} 项)` };
    }

    return { pulled: false, message: '数据已是最新' };
  } catch (e) {
    return { pulled: false, error: e instanceof Error ? e.message : '未知错误', message: '匿名同步失败' };
  }
}

export async function pushToGist(token: string): Promise<{ success: boolean; error?: string; message: string }> {
  const config = getStoredConfig();
  if (!config?.gistId) return { success: false, error: '未连接 Gist', message: '请先在设置中连接 GitHub' };
  const ok = await updateGist(config.gistId, token, packLocalData(getOrCreateDeviceId()));
  if (ok) { saveGistConfig(config.gistId, new Date().toISOString(), getOrCreateDeviceId()); return { success: true, message: '已同步到云端' }; }
  return { success: false, error: '写入 Gist 失败', message: '同步失败' };
}

export async function connectGist(token: string): Promise<{ success: boolean; gistId?: string; error?: string; message: string }> {
  const verification = await verifyToken(token);
  if (!verification.valid) return { success: false, error: verification.error, message: 'Token 无效' };
  localStorage.setItem('a4paper_github_token', token);
  const result = await pullFromGist(token);
  const config = getStoredConfig();
  return { success: result.pulled || result.pushed || !!config?.gistId, gistId: config?.gistId, message: result.message || '连接成功', error: result.error };
}

export function getStoredToken(): string | null {
  try { return localStorage.getItem('a4paper_github_token'); } catch { return null; }
}

export function clearStoredToken(): void {
  localStorage.removeItem('a4paper_github_token');
  disconnectGist();
}

export { exportAllData, importDataFromFile, safeBackupWrite, loadWithBackendFallback, setSyncUserId, getSyncUserId, clearSyncUserId } from './backendSync';
