/**
 * 阅读篇目持久化存储
 */

import type { Word } from '../types';
import { safeBackupWrite, loadWithBackendFallback, autoSyncToGist } from './backendSync';

const STORAGE_KEY = 'a4paper_reading_banks';
const BACKEND_KEY = 'reading_banks';

export interface ReadingArticle {
  id: string;
  title: string;
  source: string;
  content: string;
  words: Word[];
  createdAt: number;
}

export interface ReadingBank {
  id: string;
  title: string;
  articles: ReadingArticle[];
  createdAt: number;
}

export interface Article {
  id: string;
  title: string;
  words: Word[];
  createdAt: number;
}

let _lastSyncResult: { success: true } | { success: false; error: string } = { success: true };

export function getLastBackupSyncResult() {
  return _lastSyncResult;
}

function loadBanks(): ReadingBank[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 过滤损坏的条目（articles 不是数组的视为损坏）
    return parsed.filter((b: any) => b && Array.isArray(b.articles));
  } catch { return []; }
}

function saveBanks(banks: ReadingBank[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
  // 自动同步到 Gist（静默）
  autoSyncToGist();
}

export function getAllReadingBanks(): ReadingBank[] {
  return loadBanks();
}

export function getAllArticles(): Article[] {
  const articles: Article[] = [];
  for (const bank of loadBanks()) {
    if (!Array.isArray(bank.articles)) continue;
    for (const article of bank.articles) {
      articles.push({ id: article.id, title: article.title, words: article.words, createdAt: article.createdAt });
    }
  }
  return articles;
}

export function createArticle(title: string): Article {
  const article: ReadingArticle = {
    id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    source: '手动录入',
    content: '',
    words: [],
    createdAt: Date.now(),
  };
  const bank: ReadingBank = {
    id: `reading-${Date.now()}`,
    title,
    articles: [article],
    createdAt: Date.now(),
  };
  addReadingBank(bank);
  return { id: article.id, title: article.title, words: article.words, createdAt: article.createdAt };
}

export function addWordsToArticle(articleId: string, words: Word[]): void {
  const banks = loadBanks();
  for (const bank of banks) {
    const article = bank.articles.find(a => a.id === articleId);
    if (article) {
      article.words.push(...words);
      saveBanks(banks);
      return;
    }
  }
}

export function deleteArticle(articleId: string): void {
  const banks = loadBanks();
  for (const bank of banks) {
    const idx = bank.articles.findIndex(a => a.id === articleId);
    if (idx !== -1) {
      bank.articles.splice(idx, 1);
      if (bank.articles.length === 0) {
        const bankIdx = banks.indexOf(bank);
        banks.splice(bankIdx, 1);
      }
      saveBanks(banks);
      return;
    }
  }
}

export function getArticleById(articleId: string): { bank: ReadingBank; article: ReadingArticle } | null {
  for (const bank of loadBanks()) {
    const article = bank.articles.find(a => a.id === articleId);
    if (article) return { bank, article };
  }
  return null;
}

export function getTotalArticleWords(articleId: string): number {
  return getArticleById(articleId)?.article.words.length ?? 0;
}

/** 获取全部阅读篇目的总单词数 */
export function getTotalReadingWords(): number {
  return getAllArticles().reduce((sum, a) => sum + a.words.length, 0);
}

export function getArticlePageWords(articleId: string, pageIndex: number): Word[] {
  const result = getArticleById(articleId);
  if (!result) return [];
  const start = pageIndex * 25;
  return result.article.words.slice(start, start + 25);
}

export function getArticleTotalPages(articleId: string): number {
  const result = getArticleById(articleId);
  if (!result) return 0;
  return Math.ceil(result.article.words.length / 25);
}

export function addReadingBank(bank: ReadingBank): void {
  const banks = loadBanks();
  banks.push(bank);
  saveBanks(banks);
}

export function migrateScannedBookToReading(scannedBookId: string, title: string, content: string, words: Word[]): ReadingBank {
  const article: ReadingArticle = {
    id: `article-${scannedBookId}`,
    title,
    source: '扫描导入',
    content,
    words,
    createdAt: Date.now(),
  };
  const bank: ReadingBank = {
    id: `reading-${scannedBookId}`,
    title,
    articles: [article],
    createdAt: Date.now(),
  };
  addReadingBank(bank);
  return bank;
}

export async function restoreReadingFromBackend(): Promise<boolean> {
  const { data, fromBackend } = await loadWithBackendFallback<ReadingBank[]>(STORAGE_KEY, BACKEND_KEY);
  return fromBackend && data !== null;
}
