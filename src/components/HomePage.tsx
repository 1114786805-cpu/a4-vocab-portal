/**
 * 首页入口 — 统一词书网格
 *
 * 层级结构：
 *   雅思阅读真经  → 可直接学习（和自建词书一样用法）
 *   阅读词汇      → 点进去 → 录入阅读篇目 → 录入词汇（ArticleListPage）
 *   短语积累      → 点进去 → 管理短语（PhraseBookPage）
 *   [自建词书]    → 可直接学习
 *   + 录入词书    → CreateBookPage（保存后与雅思阅读真经同级）
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { getAllBooks, deleteCustomBook, PAGE_SIZE } from '../data/bookData';
import { getBookProgress } from '../store/persistStore';
import { getReviewRounds } from '../store/progressStore';
import { getTotalReadingWords, getAllArticles } from '../data/readingStore';
import { getPhraseCount } from '../data/phraseStore';
import { exportAllData, importDataFromFile } from '../data/backendSync';
import type { WordBook } from '../data/bookData';

interface HomePageProps {
  onStartLearning: (bookId: string, pageIndex: number) => void;
  onCreateBook?: () => void;
  onOpenReading?: () => void;
  onOpenPhraseBook?: () => void;
  onOpenSyncSettings?: () => void;
}

export function HomePage({
  onStartLearning,
  onCreateBook,
  onOpenReading,
  onOpenPhraseBook,
  onOpenSyncSettings,
}: HomePageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const allBooks = useMemo(() => getAllBooks(), [refreshKey]);
  const readingWordCount = useMemo(() => getTotalReadingWords(), [refreshKey]);
  const phraseCount = useMemo(() => getPhraseCount(), [refreshKey]);

  // 数据导入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleExport = useCallback(() => {
    exportAllData();
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importDataFromFile(file);
    if (result.success) {
      setImportMessage(`✅ ${result.message}`);
    } else {
      setImportMessage(`❌ ${result.message}`);
    }
    e.target.value = '';
    setRefreshKey(k => k + 1);
    setTimeout(() => setImportMessage(null), 5000);
  }, []);

  // 点击菜单外关闭
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCreateBookClick = useCallback(() => {
    setMenuOpen(false);
    onCreateBook?.();
  }, [onCreateBook]);

  return (
    <div className="homepage">
      {/* 顶栏 */}
      <div className="homepage-header">
        <h1 className="homepage-title">A4 Paper</h1>
        <p className="homepage-subtitle">根据 A4 纸学习法设计的单词系统</p>
      </div>

      {/* 词书网格 — 统一层级 */}
      <div className="homepage-books-section">
        <h3 className="homepage-section-title">📖 词书</h3>
        <div className="homepage-books">
          {allBooks.map(book => (
            <BookCard
              key={book.id}
              book={book}
              onStartLearning={onStartLearning}
              onDelete={(id) => {
                deleteCustomBook(id);
                setRefreshKey(k => k + 1);
              }}
            />
          ))}

          {/* 阅读词汇 — 导航卡片（点进去是篇目列表） */}
          {onOpenReading && (
            <div
              className="book-card book-card-nav"
              onClick={onOpenReading}
              role="button"
              tabIndex={0}
            >
              <div className="book-card-header">
                <div className="book-card-title-row">
                  <h2 className="book-card-title">📝 阅读词汇</h2>
                </div>
                <div className="book-card-stats">
                  <span className="book-stat">
                    {readingWordCount > 0
                      ? `${getAllArticles().length} 个篇目 · ${readingWordCount} 词`
                      : '还没有录入，点此开始'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 短语积累 — 导航卡片 */}
          {onOpenPhraseBook && (
            <div
              className="book-card book-card-nav"
              onClick={onOpenPhraseBook}
              role="button"
              tabIndex={0}
            >
              <div className="book-card-header">
                <div className="book-card-title-row">
                  <h2 className="book-card-title">💬 短语积累</h2>
                </div>
                <div className="book-card-stats">
                  <span className="book-stat">
                    {phraseCount > 0
                      ? `${phraseCount} 条短语`
                      : '还没有积累，点此开始'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 录入词书入口 */}
          {onCreateBook && (
            <div
              className="book-card book-card-nav book-card-create"
              onClick={handleCreateBookClick}
              role="button"
              tabIndex={0}
            >
              <div className="book-card-header">
                <div className="book-card-title-row">
                  <h2 className="book-card-title">✏️ 录入词书</h2>
                </div>
                <div className="book-card-stats">
                  <span className="book-stat">手动输入单词，AI 补全释义</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 数据管理 — 手动导入/导出备份 */}
      <div className="homepage-books-section">
        <div className="homepage-section-title">💾 数据管理</div>
        <div className="backup-toolbar">
          <button className="backup-btn export-btn" onClick={handleExport}>
            📤 导出数据
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button className="backup-btn import-btn" onClick={handleImportClick}>
            📥 导入数据
          </button>
          {importMessage && (
            <span className="backup-message">{importMessage}</span>
          )}
        </div>
        <p className="backup-hint">
          在设备间同步学习进度：在旧设备上导出 → 传到新设备 → 在新设备上导入
        </p>
      </div>

      {/* 云端同步 — 三端实时共享 */}
      <div className="homepage-books-section">
        <div className="homepage-section-title">☁️ 数据同步</div>
        <div className="backup-toolbar">
          <button className="backup-btn sync-btn" onClick={onOpenSyncSettings}>
            ⚙️ 同步设置
          </button>
        </div>
        <p className="backup-hint">
          通过 GitHub Gist 在三台设备之间自动同步学习记录
        </p>
      </div>
    </div>
  );
}

function BookCard({
  book,
  onStartLearning,
  onDelete,
}: {
  book: WordBook;
  onStartLearning: HomePageProps['onStartLearning'];
  onDelete?: (bookId: string) => void;
}) {
  const progress = getBookProgress(book.id);
  const completedCount = progress.completedPages.length;
  const isCustom = book.id.startsWith('custom-');

  return (
    <div className={`book-card ${isCustom ? 'book-card-custom' : ''}`}>
      <div className="book-card-header">
        <div className="book-card-title-row">
          <h2 className="book-card-title">{book.title}</h2>
          {isCustom && onDelete && (
            <button
              className="book-card-del-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`确定删除词书「${book.title}」吗？`)) {
                  onDelete(book.id);
                }
              }}
              title="删除词书"
            >
              🗑️
            </button>
          )}
        </div>
        <div className="book-card-stats">
          <span className="book-stat">{book.words.length} 词</span>
          <span className="book-stat-divider">·</span>
          <span className="book-stat">{book.totalPages} 页</span>
          <span className="book-stat-divider">·</span>
          <span className="book-stat">已完成 {completedCount}/{book.totalPages}</span>
        </div>
      </div>

      <PageGrid
        book={book}
        completedPages={progress.completedPages}
        currentPage={progress.currentPage}
        onStartLearning={onStartLearning}
      />
    </div>
  );
}

function PageGrid({
  book,
  completedPages,
  currentPage,
  onStartLearning,
}: {
  book: WordBook;
  completedPages: number[];
  currentPage: number;
  onStartLearning: HomePageProps['onStartLearning'];
}) {
  const totalPages = book.totalPages;
  const words = book.words;

  const pages = useMemo(() => {
    const result: {
      pageIndex: number;
      start: number;
      end: number;
      completed: boolean;
      isCurrent: boolean;
      reviewRounds: number;
    }[] = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * PAGE_SIZE + 1;
      const end = Math.min((i + 1) * PAGE_SIZE, words.length);
      const reviewRounds = getReviewRounds(book.id, i);
      result.push({
        pageIndex: i,
        start,
        end,
        completed: completedPages.includes(i),
        isCurrent: currentPage === i && !completedPages.includes(i),
        reviewRounds,
      });
    }
    return result;
  }, [totalPages, words.length, completedPages, currentPage, book.id]);

  return (
    <div className="page-grid">
      {pages.map(page => {
        const dots = page.reviewRounds;

        return (
          <button
            key={page.pageIndex}
            className={`page-btn ${page.completed ? 'completed' : ''} ${page.isCurrent ? 'current' : ''}`}
            onClick={() => onStartLearning(book.id, page.pageIndex)}
            title={`第${page.pageIndex + 1}页 (${page.start}~${page.end}词) — 已完整复习 ${page.reviewRounds} 轮`}
          >
            <span className="page-num">{page.pageIndex + 1}</span>
            {dots > 0 && (
              <span className="page-btn-dots">
                {Array.from({ length: dots }, (_, i) => (
                  <span key={i} className="page-btn-dot filled" />
                ))}
                {Array.from({ length: 5 - dots }, (_, i) => (
                  <span key={dots + i} className="page-btn-dot" />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
