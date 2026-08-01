/**
 * 词书数据
 * 预置词书 + 自建词书 + 内嵌单词库
 */

import type { Word } from '../types';
import { ieltsCoreWords } from './ieltsWords';
import { safeBackupWrite, autoSyncToGist } from './backendSync';

export interface WordBook {
  id: string;
  title: string;
  description: string;
  pageSize: number;
  words: Word[];
  totalPages: number;
}

export const PAGE_SIZE = 25;

function paginateWords(words: Word[], id: string, title: string, description: string): WordBook {
  return {
    id,
    title,
    description,
    pageSize: PAGE_SIZE,
    words,
    totalPages: Math.ceil(words.length / PAGE_SIZE),
  };
}

/** 雅思阅读真经 — 剑桥雅思核心 3000 词 */
const IELTS_BOOK = paginateWords(
  ieltsCoreWords,
  'cambridge-ielts-1',
  '雅思阅读真经',
  '剑桥雅思核心词汇（约3000词）'
);

// ===== 自建词书持久化 =====
const CUSTOM_BOOKS_KEY = 'a4paper_custom_books';

function loadCustomBooks(): WordBook[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomBooks(books: WordBook[]): void {
  localStorage.setItem(CUSTOM_BOOKS_KEY, JSON.stringify(books));
  autoSyncToGist();
}

/** 获取全部词书（内置 + 自建） */
export function getAllBooks(): WordBook[] {
  const custom = loadCustomBooks();
  return [IELTS_BOOK, ...custom];
}

/** 新增自建词书 */
export function addCustomBook(title: string, words: Word[]): WordBook {
  const custom = loadCustomBooks();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const book = paginateWords(words, id, title, `${words.length} 个单词`);
  custom.push(book);
  saveCustomBooks(custom);
  return book;
}

/** 删除自建词书 */
export function deleteCustomBook(bookId: string): boolean {
  const custom = loadCustomBooks();
  const idx = custom.findIndex(b => b.id === bookId);
  if (idx === -1) return false;
  custom.splice(idx, 1);
  saveCustomBooks(custom);
  return true;
}

export function getBookById(bookId: string): WordBook | null {
  if (bookId === IELTS_BOOK.id) return IELTS_BOOK;
  const custom = loadCustomBooks();
  return custom.find(b => b.id === bookId) ?? null;
}

export function getPageWords(bookId: string, pageIndex: number): Word[] {
  const book = getBookById(bookId);
  if (!book) return [];
  const start = pageIndex * PAGE_SIZE;
  return book.words.slice(start, start + PAGE_SIZE);
}
