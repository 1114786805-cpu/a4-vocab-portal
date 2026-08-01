/**
 * 持久化存储
 * 词书库、学习进度、错词记录全部存 localStorage
 */

import type { Word } from '../types';
import { safeBackupWrite, loadWithBackendFallback } from '../data/backendSync';

/* ================================================================
 *   Key 常量
 * ================================================================ */
const STORAGE_KEYS = {
  PROGRESS: 'a4paper_progress',
  ERROR_WORDS: 'a4paper_error_words',
  LEARNING_HISTORY: 'a4paper_learning_history',
  API_KEY: 'a4paper_deepseek_api_key',
  BOOK_PROGRESS: 'a4paper_book_progress_v2',
} as const;

const BACKEND_KEY_PROGRESS = 'progress';

/* ================================================================
 *   手动同步兼容（占位，保留导出/导入时的一致性）
 * ================================================================ */

/** 获取最近一次同步结果（空实现，保留给外部检查用） */
export function getProgressSyncResult() {
  return { success: true } as const;
}

/** 从 localStorage 恢复 progress 数据 */
export async function restoreProgressFromBackend(): Promise<boolean> {
  const { data } = await loadWithBackendFallback<BookProgressMap>(
    STORAGE_KEYS.BOOK_PROGRESS,
    BACKEND_KEY_PROGRESS,
  );
  return data !== null;
}

/* ================================================================
 *   学习进度：每页的完成状态 & 错词
 * ================================================================ */
export interface BookProgressEntry {
  bookId: string;
  currentPage: number;
  completedPages: number[];
  errorWords: {
    pageIndex: number;
    wordId: string;
    word: string;
    userInput: string;
    errorDetail?: string;
    timestamp: number;
  }[];
  history: {
    pageIndex: number;
    wordId: string;
    correct: boolean;
    userInput: string;
    errorDetail?: string;
    timestamp: number;
  }[];
  lastSessionTimestamp: number;
}

export interface BookProgressMap {
  [bookId: string]: BookProgressEntry | undefined;
}

function getBookProgressMap(): BookProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOK_PROGRESS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBookProgressMap(map: BookProgressMap) {
  localStorage.setItem(STORAGE_KEYS.BOOK_PROGRESS, JSON.stringify(map));
  // 异步写后端（如果环境支持）
  safeBackupWrite(STORAGE_KEYS.BOOK_PROGRESS, BACKEND_KEY_PROGRESS, map);
}

export function getBookProgress(bookId: string): BookProgressEntry {
  const map = getBookProgressMap();
  return map[bookId] ?? {
    bookId,
    currentPage: 0,
    completedPages: [],
    errorWords: [],
    history: [],
    lastSessionTimestamp: 0,
  };
}

export function updateBookProgress(bookId: string, patch: Partial<BookProgressEntry>) {
  const map = getBookProgressMap();
  const current = map[bookId] ?? {
    bookId,
    currentPage: 0,
    completedPages: [],
    errorWords: [],
    history: [],
    lastSessionTimestamp: 0,
  };
  map[bookId] = { ...current, ...patch, lastSessionTimestamp: Date.now() };
  saveBookProgressMap(map);
}

export function markPageCompleted(bookId: string, pageIndex: number) {
  const entry = getBookProgress(bookId);
  if (entry.completedPages.includes(pageIndex)) return;
  updateBookProgress(bookId, {
    completedPages: [...entry.completedPages, pageIndex],
    currentPage: pageIndex + 1,
  });
}

export function savePageErrorWords(
  bookId: string,
  pageIndex: number,
  errorWords: { word: Word; userInput: string; errorDetail?: string }[],
) {
  const entry = getBookProgress(bookId);
  const newErrors = errorWords.map(ew => ({
    pageIndex,
    wordId: ew.word.id,
    word: ew.word.word,
    userInput: ew.userInput,
    errorDetail: ew.errorDetail,
    timestamp: Date.now(),
  }));
  updateBookProgress(bookId, {
    errorWords: [...entry.errorWords, ...newErrors],
  });
}

export function savePageHistory(
  bookId: string,
  pgIndex: number,
  history: { wordId: string; correct: boolean; userInput: string; errorDetail?: string; timestamp: number }[],
) {
  const entry = getBookProgress(bookId);
  const enrichedHistory = history.map(h => ({ ...h, pageIndex: pgIndex }));
  updateBookProgress(bookId, {
    history: [...entry.history, ...enrichedHistory],
  });
}

export function setCurrentPage(bookId: string, page: number) {
  updateBookProgress(bookId, { currentPage: page });
}

/* ================================================================
 *   A4 词持久化（学习到一半关掉页面，A4纸上的词不丢）
 * ================================================================ */
const A4_WORDS_KEY_PREFIX = 'a4paper_a4words_';

function getA4WordsKey(bookId: string, pageIndex: number): string {
  return `${A4_WORDS_KEY_PREFIX}${bookId}_p${pageIndex}`;
}

export function saveA4Words(bookId: string, pageIndex: number, words: Word[]) {
  try {
    localStorage.setItem(getA4WordsKey(bookId, pageIndex), JSON.stringify(words));
  } catch {}
}

export function getA4Words(bookId: string, pageIndex: number): Word[] {
  try {
    const raw = localStorage.getItem(getA4WordsKey(bookId, pageIndex));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearA4Words(bookId: string, pageIndex: number) {
  localStorage.removeItem(getA4WordsKey(bookId, pageIndex));
}

/* ================================================================
 *   阅读篇目 A4 词持久化
 * ================================================================ */
const A4_WORDS_READING_PREFIX = 'a4paper_reading_a4words_';

function getReadingA4WordsKey(articleId: string, pageIndex: number): string {
  return `${A4_WORDS_READING_PREFIX}${articleId}_p${pageIndex}`;
}

export function saveReadingA4Words(articleId: string, pageIndex: number, words: Word[]) {
  try {
    localStorage.setItem(getReadingA4WordsKey(articleId, pageIndex), JSON.stringify(words));
  } catch {}
}

export function getReadingA4Words(articleId: string, pageIndex: number): Word[] {
  try {
    const raw = localStorage.getItem(getReadingA4WordsKey(articleId, pageIndex));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearReadingA4Words(articleId: string, pageIndex: number) {
  localStorage.removeItem(getReadingA4WordsKey(articleId, pageIndex));
}

/* ================================================================
 *   API Key
 * ================================================================ */
export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.API_KEY);
}

export function saveApiKey(key: string) {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key);
}
