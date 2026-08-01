/**
 * 短语词书持久化存储
 */

import { safeBackupWrite, loadWithBackendFallback } from './backendSync';

const STORAGE_KEY = 'a4paper_phrases';
const BACKEND_KEY = 'phrases';

export interface PhraseEntry {
  id: string;
  phrase: string;
  meaning: string;
  example: string;
  category: string;
  createdAt: number;
}

let _lastSyncResult: { success: true } | { success: false; error: string } = { success: true };

export function getPhraseSyncResult() {
  return _lastSyncResult;
}

function loadPhrases(): PhraseEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePhrases(phrases: PhraseEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases));
}

export function getAllPhrases(): PhraseEntry[] {
  return loadPhrases();
}

export function getPhraseCount(): number {
  return loadPhrases().length;
}

export function addPhrase(phrase: PhraseEntry): void {
  const phrases = loadPhrases();
  phrases.push(phrase);
  savePhrases(phrases);
}

export function updatePhrase(id: string, data: Partial<PhraseEntry>): void {
  const phrases = loadPhrases();
  const idx = phrases.findIndex(p => p.id === id);
  if (idx !== -1) {
    phrases[idx] = { ...phrases[idx], ...data };
    savePhrases(phrases);
  }
}

export function deletePhrase(id: string): void {
  const phrases = loadPhrases().filter(p => p.id !== id);
  savePhrases(phrases);
}

export async function restorePhrasesFromBackend(): Promise<boolean> {
  const { data, fromBackend } = await loadWithBackendFallback<PhraseEntry[]>(STORAGE_KEY, BACKEND_KEY);
  return fromBackend && data !== null;
}
