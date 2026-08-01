/**
 * 精细化的学习进度持久化
 * 记录：每页每个单词的学习状态、每组完成度、每页完成度
 * 存储：localStorage（主）+ 后端 JSON 文件备份
 * 写入流程：先写 localStorage → await 后端确认（批量去抖）
 * 启动恢复：localStorage 为空时从后端拉取
 */

import type { Word } from '../types';
import { safeBackupWrite, loadWithBackendFallback } from '../data/backendSync';

const STORAGE_KEY = 'a4paper_mastery_v3';
const BACKEND_KEY = 'mastery';

/* ================================================================
 *   后端同步（批量去抖）
 * ================================================================ */

let _pendingSync: Promise<void> | null = null;
let _pendingData: MasteryData | null = null;
let _lastSyncResult: { success: true } | { success: false; error: string } = { success: true };

async function _flushSync() {
  const data = _pendingData;
  if (!data) return;
  _pendingData = null;
  _lastSyncResult = await safeBackupWrite(STORAGE_KEY, BACKEND_KEY, data);
}

function _scheduleSync(data: MasteryData) {
  _pendingData = data;
  if (!_pendingSync) {
    _pendingSync = new Promise<void>(resolve => {
      Promise.resolve().then(async () => {
        await _flushSync();
        _pendingSync = null;
        resolve();
      });
    });
  }
}

/** 获取最近一次 mastery 同步结果 */
export function getMasterySyncResult() {
  return _lastSyncResult;
}

/** 从后端恢复 mastery 数据 */
export async function restoreMasteryFromBackend(): Promise<boolean> {
  const { data, fromBackend } = await loadWithBackendFallback<MasteryData>(
    STORAGE_KEY,
    BACKEND_KEY,
  );
  return fromBackend && data !== null;
}

/* ================================================================
 *   数据结构
 * ================================================================ */

/** 单个单词的掌握状态 */
export interface WordMastery {
  wordId: string;
  word: string;
  /** 学习次数 */
  attempts: number;
  /** 正确次数 */
  corrects: number;
  /** 是否已掌握（至少正确记忆一次） */
  mastered: boolean;
  /** 最后学习时间 */
  lastStudied: number;
}

/** 每组的完成状态——满格5个绿点 */
export interface GroupMastery {
  groupIndex: number;
  wordIds: string[];
  completedWords: string[];
  allCompleted: boolean;
}

/** 每页的完成状态 */
export interface PageMastery {
  pageIndex: number;
  bookId: string;
  pageCompleted: boolean;
  wordMastery: Record<string, WordMastery>;
  groups: GroupMastery[];
  hasStarted: boolean;
  reviewRounds: number;
  lastStudied: number;
}

/** 整本书的掌握进度 */
export interface BookMastery {
  bookId: string;
  pages: Record<number, PageMastery>;
  lastSessionTimestamp: number;
}

/** 所有书的进度 */
export type MasteryData = Record<string, BookMastery>;

/* ================================================================
 *   工具函数
 * ================================================================ */

function loadMastery(): MasteryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMastery(data: MasteryData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  _scheduleSync(data);
}

function ensurePageMastery(data: MasteryData, bookId: string, pageIndex: number, words: Word[]): PageMastery {
  const book = data[bookId] ?? (data[bookId] = { bookId, pages: {}, lastSessionTimestamp: 0 });
  const existing = book.pages[pageIndex];
  if (existing) return existing;

  const groupSize = 5;
  const groups: GroupMastery[] = [];

  for (let gi = 0; gi < 5; gi++) {
    const start = gi * groupSize;
    const groupWords = words.slice(start, start + groupSize);
    groups.push({
      groupIndex: gi,
      wordIds: groupWords.map(w => w.id),
      completedWords: [],
      allCompleted: false,
    });
  }

  const page: PageMastery = {
    pageIndex,
    bookId,
    pageCompleted: false,
    wordMastery: {},
    groups,
    hasStarted: false,
    reviewRounds: 0,
    lastStudied: 0,
  };

  book.pages[pageIndex] = page;
  return page;
}

/* ================================================================
 *   核心API
 * ================================================================ */

export function markWordMastered(bookId: string, pageIndex: number, word: Word) {
  const data = loadMastery();
  const page = ensurePageMastery(data, bookId, pageIndex, [word]);

  page.hasStarted = true;
  page.lastStudied = Date.now();

  const existing = page.wordMastery[word.id];
  page.wordMastery[word.id] = {
    wordId: word.id,
    word: word.word,
    attempts: (existing?.attempts ?? 0) + 1,
    corrects: (existing?.corrects ?? 0) + 1,
    mastered: true,
    lastStudied: Date.now(),
  };

  for (const group of page.groups) {
    if (group.wordIds.includes(word.id) && !group.completedWords.includes(word.id)) {
      group.completedWords.push(word.id);
      group.allCompleted = group.completedWords.length >= group.wordIds.length;
      break;
    }
  }

  page.pageCompleted = page.groups.every(g => g.allCompleted);
  data[bookId].lastSessionTimestamp = Date.now();
  saveMastery(data);
}

export function markWordWrong(bookId: string, pageIndex: number, word: Word) {
  const data = loadMastery();
  const page = ensurePageMastery(data, bookId, pageIndex, [word]);

  page.hasStarted = true;
  page.lastStudied = Date.now();

  const existing = page.wordMastery[word.id];
  page.wordMastery[word.id] = {
    wordId: word.id,
    word: word.word,
    attempts: (existing?.attempts ?? 0) + 1,
    corrects: existing?.corrects ?? 0,
    mastered: false,
    lastStudied: Date.now(),
  };

  data[bookId].lastSessionTimestamp = Date.now();
  saveMastery(data);
}

export function getGroupMastery(bookId: string, pageIndex: number, groupIndex: number): GroupMastery | null {
  const data = loadMastery();
  const page = data[bookId]?.pages?.[pageIndex];
  if (!page) return null;
  return page.groups[groupIndex] ?? null;
}

export function getPageGroups(bookId: string, pageIndex: number): GroupMastery[] | null {
  const data = loadMastery();
  const page = data[bookId]?.pages?.[pageIndex];
  if (!page) return null;
  return page.groups;
}

export function getCompletedPages(bookId: string): number[] {
  const data = loadMastery();
  const book = data[bookId];
  if (!book) return [];
  return Object.entries(book.pages)
    .filter(([, p]) => p.pageCompleted)
    .map(([idx]) => Number(idx));
}

export function getPageProgressPercent(bookId: string, pageIndex: number): number {
  const data = loadMastery();
  const page = data[bookId]?.pages?.[pageIndex];
  if (!page) return 0;
  const totalWords = page.groups.reduce((sum, g) => sum + g.wordIds.length, 0);
  const masteredWords = Object.values(page.wordMastery).filter(w => w.mastered).length;
  return totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
}

export function getPageWordProgress(bookId: string, pageIndex: number): { mastered: number; total: number } | null {
  const data = loadMastery();
  const page = data[bookId]?.pages?.[pageIndex];
  if (!page) return null;
  const total = page.groups.reduce((sum, g) => sum + g.wordIds.length, 0);
  const mastered = Object.values(page.wordMastery).filter(w => w.mastered).length;
  return { mastered, total };
}

export function incrementReviewRound(bookId: string, pageIndex: number) {
  const data = loadMastery();
  const book = data[bookId];
  if (!book) return;
  const page = book.pages[pageIndex];
  if (!page) return;
  page.reviewRounds = (page.reviewRounds ?? 0) + 1;
  book.lastSessionTimestamp = Date.now();
  saveMastery(data);
}

export function getReviewRounds(bookId: string, pageIndex: number): number {
  const data = loadMastery();
  return data[bookId]?.pages?.[pageIndex]?.reviewRounds ?? 0;
}

export function shouldPageReview(bookId: string, pageIndex: number): boolean {
  const data = loadMastery();
  return (data[bookId]?.pages?.[pageIndex]?.reviewRounds ?? 0) > 0;
}
