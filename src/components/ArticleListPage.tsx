/**
 * ArticleListPage — 阅读生词簿
 *
 * 显示所有阅读篇目列表，点击进入单词录入页面。
 * 底部有「+ 新建篇目」按钮。
 *
 * 使用场景：
 *   做完一篇阅读理解后 → 点进来 → 新建篇目（输入篇目标题）
 *   → 逐词录入生词 → 保存 → 回到篇目列表
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAllArticles,
  createArticle,
  addWordsToArticle,
  getArticleById,
  deleteArticle,
  type Article,
} from '../data/readingStore';
import { completeWords, getApiKey, type WordCompleteResult } from '../ai/completeWords';
import type { Word } from '../types';

type AlPhase = 'list' | 'create-article' | 'add-words' | 'completing' | 'results' | 'done';

interface ArticleListPageProps {
  onBack: () => void;
  onStartLearning?: (articleId: string, pageIndex?: number) => void;
}

export function ArticleListPage({ onBack, onStartLearning }: ArticleListPageProps) {
  const [articles, setArticles] = useState<Article[]>(() => getAllArticles());
  const [phase, setPhase] = useState<AlPhase>('list');
  const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [rawWords, setRawWords] = useState<string[]>([]);
  const [completeResults, setCompleteResults] = useState<WordCompleteResult[]>([]);
  const [completingProgress, setCompletingProgress] = useState({ done: 0, total: 0 });
  const [apiKey, setApiKey] = useState(() => getApiKey());
  const inputRef = useRef<HTMLInputElement>(null);

  // ===== 刷新列表 =====
  const refreshArticles = useCallback(() => {
    setArticles(getAllArticles());
  }, []);

  // ===== Phase list: 点进某个篇目开始录词 =====
  const handleStartAddWords = useCallback((articleId: string) => {
    const article = getArticleById(articleId);
    if (!article) return;
    setCurrentArticleId(articleId);
    setArticleTitle(article.title);
    setRawWords([]);
    setCompleteResults([]);
    setWordInput('');
    setPhase('add-words');
    // 给焦点时间
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ===== Phase create-article: 新建篇目 =====
  const handleCreateArticle = useCallback(() => {
    const title = articleTitle.trim();
    if (!title) return;
    const article = createArticle(title);
    // 建好后直接进入 add-words
    setCurrentArticleId(article.id);
    setArticleTitle(article.title);
    setRawWords([]);
    setCompleteResults([]);
    setWordInput('');
    setPhase('add-words');
    refreshArticles();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [articleTitle, refreshArticles]);

  const handleDeleteArticle = useCallback((articleId: string) => {
    if (!confirm('确定删除此篇目吗？单词将全部丢失。')) return;
    deleteArticle(articleId);
    refreshArticles();
  }, [refreshArticles]);

  // ===== Phase add-words: 添加单词 =====
  const handleAddWord = useCallback(() => {
    const w = wordInput.trim().toLowerCase();
    if (!w || rawWords.includes(w)) return;
    if (!/^[a-z\-]+$/.test(w)) {
      alert('请输入纯英文单词（字母或连字符）');
      return;
    }
    setRawWords(prev => [...prev, w]);
    setWordInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [wordInput, rawWords]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (wordInput.trim()) {
        handleAddWord();
      }
    }
  }, [handleAddWord, wordInput]);

  const removeWord = useCallback((idx: number) => {
    setRawWords(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleBulkAdd = useCallback(() => {
    const text = prompt('粘贴或输入多个单词，用空格/逗号/换行分隔：');
    if (!text) return;
    const words = text
      .split(/[\s,，\n]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && /^[a-z\-]+$/.test(w) && !rawWords.includes(w));
    if (words.length === 0) {
      alert('没有可添加的有效单词');
      return;
    }
    setRawWords(prev => [...prev, ...words]);
  }, [rawWords]);

  // ===== Phase completing: AI 补全 =====
  const startCompleting = useCallback(async () => {
    let key = apiKey;
    if (!key) {
      const input = prompt('请输入 DeepSeek API Key：');
      if (!input) return;
      key = input.trim();
      if (!key) return;
      localStorage.setItem('wordsense_api_key', key);
      setApiKey(key);
    }

    if (rawWords.length === 0) return;

    setPhase('completing');
    setCompletingProgress({ done: 0, total: rawWords.length });

    try {
      const results = await completeWords(
        rawWords,
        key,
        (done, total) => setCompletingProgress({ done, total }),
      );
      setCompleteResults(results);
      setPhase('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      alert(`AI 补全失败：${msg}`);
      setPhase('add-words');
    }
  }, [rawWords, apiKey]);

  // ===== Phase results: 保存 =====
  const handleSave = useCallback(() => {
    if (!currentArticleId) return;

    const words: Word[] = [];
    for (const r of completeResults) {
      if (!r.success || !r.data) continue;
      const d = r.data;
      words.push({
        id: d.word.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        word: d.word,
        pos: d.pos || '',
        definition: d.definition || '',
        coreConcept: d.coreConcept || '',
        examples: d.examples || [],
        collocations: d.collocations || [],
        phonetic: d.phonetic || '',
      });
    }

    if (words.length === 0) {
      alert('没有成功补全的单词，无法保存');
      return;
    }

    addWordsToArticle(currentArticleId, words);
    setPhase('done');
    refreshArticles();
  }, [currentArticleId, completeResults, refreshArticles]);

  // ===== Phase done: 确定后回篇目列表 =====
  const handleDoneBack = useCallback(() => {
    setPhase('list');
    refreshArticles();
  }, [refreshArticles]);

  // ===== Render =====
  const currentArticleTitle = articleTitle;

  return (
    <div className="article-list-page">
      {/* 顶栏 */}
      <div className="article-list-nav">
        <button className="nav-back-btn" onClick={onBack}>← 首页</button>
        <span className="article-list-title">📖 阅读生词簿</span>
      </div>

      {/* Phase list: 篇目列表 */}
      {phase === 'list' && (
        <div className="article-list-phase">
          <p className="article-list-hint">
            把每篇阅读理解中不会的单词按篇目分类整理
          </p>

          {articles.length === 0 && (
            <div className="article-empty-state">
              <div className="article-empty-icon">📚</div>
              <p className="article-empty-text">还没有阅读篇目</p>
              <p className="article-empty-sub">点击下方按钮新建篇目，开始录入生词</p>
            </div>
          )}

          {articles.length > 0 && (
            <div className="article-cards">
              {articles.map(article => (
                <div key={article.id} className="article-card">
                  {/* ★ 点击卡片主体 → 进入学习（仅当有单词时） */}
                  <div
                    className="article-card-main"
                    onClick={() => {
                      if (article.words.length > 0 && onStartLearning) {
                        onStartLearning(article.id);
                      }
                    }}
                    style={{ cursor: article.words.length > 0 && onStartLearning ? 'pointer' : 'default' }}
                  >
                    <div className="article-card-title">{article.title}</div>
                    <div className="article-card-stats">
                      <span>{article.words.length} 个单词</span>
                      {article.words.length > 0 && onStartLearning && (
                        <span className="article-card-learn-hint">📖 点击学习</span>
                      )}
                      <span className="article-card-date">
                        {new Date(article.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div className="article-card-actions">
                    {/* ★ 小按钮：管理单词（录词入口） */}
                    <button
                      className="article-card-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartAddWords(article.id);
                      }}
                      title="管理单词"
                    >
                      ✏️
                    </button>
                    <button
                      className="article-card-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteArticle(article.id);
                      }}
                      title="删除篇目"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="article-create-btn"
            onClick={() => {
              setArticleTitle('');
              setPhase('create-article');
            }}
          >
            + 新建篇目
          </button>
        </div>
      )}

      {/* Phase create-article: 输入篇目标题 */}
      {phase === 'create-article' && (
        <div className="article-list-phase">
          <div className="create-book-phase">
            <div className="create-book-icon">📄</div>
            <h2>新建阅读篇目</h2>
            <p className="create-book-hint">
              输入篇目标题，比如 "Passage 1: What is a Nation?"
            </p>
            <input
              className="create-book-input"
              type="text"
              placeholder="输入篇目标题..."
              value={articleTitle}
              onChange={e => setArticleTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateArticle(); }}
              autoFocus
            />
            <div className="create-book-actions">
              <button className="create-book-btn primary" onClick={handleCreateArticle} disabled={!articleTitle.trim()}>
                创建并录入单词
              </button>
              <button className="create-book-btn secondary" onClick={() => setPhase('list')}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase add-words: 输入单词 */}
      {phase === 'add-words' && (
        <div className="article-list-phase">
          <div className="create-book-phase">
            <h2>
              📖 {currentArticleTitle}
              <span className="create-book-word-count">{rawWords.length} 个待录入</span>
            </h2>

            <div className="create-book-input-row">
              <input
                ref={inputRef}
                className="create-book-input"
                type="text"
                placeholder="输入单词，按 Enter 添加..."
                value={wordInput}
                onChange={e => setWordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button className="create-book-btn small" onClick={handleAddWord} disabled={!wordInput.trim()}>
                添加
              </button>
            </div>

            <button className="create-book-btn bulk-add" onClick={handleBulkAdd}>
              📋 批量添加
            </button>

            {rawWords.length > 0 && (
              <div className="create-book-word-list">
                {rawWords.map((w, i) => (
                  <span key={i} className="create-book-word-tag">
                    {w}
                    <button className="create-book-tag-remove" onClick={() => removeWord(i)}>×</button>
                  </span>
                ))}
              </div>
            )}

            {rawWords.length > 0 && (
              <div className="create-book-actions">
                <button className="create-book-btn primary" onClick={startCompleting}>
                  🤖 AI 一键补全（{rawWords.length} 个词）
                </button>
                <button className="create-book-btn secondary" onClick={() => { setPhase('list'); refreshArticles(); }}>
                  ← 返回列表（不保存）
                </button>
              </div>
            )}

            {rawWords.length === 0 && (
              <p className="article-empty-sub" style={{ marginTop: 24 }}>
                输入单词后点击「AI 一键补全」自动生成释义
              </p>
            )}
          </div>
        </div>
      )}

      {/* Phase completing */}
      {phase === 'completing' && (
        <div className="article-list-phase">
          <div className="scan-processing">
            <div className="scan-spinner" />
            <p className="scan-progress-text">🤖 AI 正在补全单词信息...</p>
            <p className="scan-progress-sub">
              已处理 {completingProgress.done}/{completingProgress.total} 个单词
            </p>
            <div className="scan-progress-bar">
              <div className="scan-progress-fill" style={{
                width: `${completingProgress.total > 0 ? (completingProgress.done / completingProgress.total * 100) : 0}%`,
              }} />
            </div>
            <p className="scan-progress-pct">
              {completingProgress.total > 0
                ? Math.round(completingProgress.done / completingProgress.total * 100)
                : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Phase results */}
      {phase === 'results' && (
        <div className="article-list-phase">
          <div className="create-book-phase">
            <h2>📖 {currentArticleTitle} — 补全结果</h2>

            <div className="create-book-summary">
              <span>✅ 成功: {completeResults.filter(r => r.success).length} 个</span>
              <span>❌ 失败: {completeResults.filter(r => !r.success).length} 个</span>
            </div>

            <div className="create-book-results">
              {completeResults.map((r, i) => (
                <div key={i} className={`create-book-result-item ${r.success ? 'success' : 'fail'}`}>
                  <div className="cb-result-header">
                    <span className="cb-result-word">{r.word}</span>
                    {r.success ? (
                      <span className="cb-result-badge success">✅</span>
                    ) : (
                      <span className="cb-result-badge fail">❌</span>
                    )}
                  </div>
                  {r.success && r.data && (
                    <div className="cb-result-body">
                      <span className="cb-result-phonetic">{r.data.phonetic}</span>
                      <span className="cb-result-pos">{r.data.pos}</span>
                      <span className="cb-result-def">{r.data.definition}</span>
                      <div className="cb-result-examples">
                        {r.data.examples.map((ex, j) => (
                          <span key={j} className="cb-result-example">{ex}</span>
                        ))}
                      </div>
                      {r.data.collocations.length > 0 && (
                        <div className="cb-result-collocs">
                          {r.data.collocations.map((c, j) => (
                            <span key={j} className="cb-result-colloc">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!r.success && r.error && (
                    <p className="cb-result-error">{r.error}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="create-book-actions">
              <button className="create-book-btn primary" onClick={handleSave}>
                💾 保存到阅读生词簿
              </button>
              <button className="create-book-btn secondary" onClick={() => { setPhase('add-words'); }}>
                + 继续添加单词
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase done */}
      {phase === 'done' && (
        <div className="article-list-phase">
          <div className="create-book-phase">
            <div className="create-book-icon done">✅</div>
            <h2>录入完成！</h2>
            <p className="create-book-hint">
              「{currentArticleTitle}」已保存 {completeResults.filter(r => r.success).length} 个单词
            </p>
            <div className="create-book-actions">
              <button className="create-book-btn primary" onClick={handleDoneBack}>
                返回篇目列表
              </button>
              {currentArticleId && (
                <button className="create-book-btn secondary" onClick={() => {
                  setRawWords([]);
                  setCompleteResults([]);
                  setWordInput('');
                  setPhase('add-words');
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}>
                  + 继续录入新单词
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
