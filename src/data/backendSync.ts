/**
 * 后端同步适配层
 * 所有与后端的交互统一走这里，方便后续迁移
 *
 * 当前实现：localStorage + 可选 Gist 自动同步
 *
 * 注意：不直接 import gistSync.ts（避免循环引用——gistSync 会 reexport 本文件）
 *       改用动态 import
 */

/* ================================================================
 *   要同步的数据 key
 * ================================================================ */
const SYNC_KEYS = [
  'a4paper_book_progress_v2',
  'a4paper_mastery_v3',
  'a4paper_deepseek_api_key',
  'a4paper_phrases',
  'a4paper_reading_banks',
  'a4paper_learning_history',
  'a4paper_error_words',
  'a4paper_progress',
];

/* ================================================================
 *   数据导出/导入
 * ================================================================ */

/** 导出所有数据为 JSON */
export function exportAllData(): void {
  const data: Record<string, unknown> = {};
  let hasData = false;

  for (const key of SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
        hasData = true;
      }
    } catch {}
  }

  if (!hasData) {
    alert('暂无数据可导出');
    return;
  }

  const blob = new Blob([JSON.stringify({ version: 2, data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `a4paper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  success: boolean;
  keys: string[];
  error?: string;
}

/** 从文件导入数据 */
export function importDataFromFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = JSON.parse(e.target?.result as string);
        const data = result.data ?? result;
        const keys: string[] = [];

        for (const [key, value] of Object.entries(data)) {
          try {
            localStorage.setItem(key, JSON.stringify(value));
            keys.push(key);
          } catch {}
        }

        resolve({ success: true, keys });
      } catch (err) {
        resolve({ success: false, keys: [], error: '文件格式错误' });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, keys: [], error: '文件读取失败' });
    };

    reader.readAsText(file);
  });
}

/* ================================================================
 *   自动 Gist 同步
 * ================================================================ */

/** 如果已连接 Gist，自动推送到云端（静默、不弹窗） */
export async function autoSyncToGist(): Promise<void> {
  try {
    const { getStoredToken, pushToGist } = await import('./gistSync');
    const token = getStoredToken();
    if (!token) return; // 没连接 Gist，跳过
    await pushToGist(token);
  } catch {
    // 静默失败，不影响用户操作
  }
}

/** 安全写后端（改为 auto-sync，不需传参） */
export async function safeBackupWrite<T>(
  _localKey: string,
  _backendKey: string,
  _data: T,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getStoredToken, pushToGist } = await import('./gistSync');
    const token = getStoredToken();
    if (!token) return { success: true };
    await pushToGist(token);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** 从后端/本地回退加载 */
export const loadWithBackendFallback = async <T>(key: string, _: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { data: JSON.parse(raw) as T, fromBackend: false };
  } catch {}
  return { data: null as T | null, fromBackend: false };
};

/* ================================================================
 *   User ID 管理（本地，非同步）
 * ================================================================ */

const USER_ID_KEY = 'a4paper_sync_user_id';

export function setSyncUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

export function getSyncUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function clearSyncUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

export type { ImportResult };
