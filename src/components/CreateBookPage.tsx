/**
 * CreateBookPage — 录入词书 + AI 补全释义
 *
 * 工作流程：
 * 1. Phase: 'create-book' — 输入词书名称，创建空词书
 * 2. Phase: 'add-words'   — 逐个手动输入单词，按 Enter 添加
 * 3. Phase: 'completing'  — 调 DeepSeek 逐词补全释义/音标/例句等
 * 4. Phase: 'results'     — 展示补全结果，可选编辑后保存
 * 5. Phase: 'done'        — 保存完成，引导回到首页
 *
 * 保存目标：作为独立词书（与雅思阅读真经同级），而非阅读篇目
 */

import { useState, useCallback, useRef } from 'react';
import { completeWords, getApiKey, type WordCompleteResult } from '../ai/completeWords';
import { addCustomBook } from '../data/bookData';
import type { Word } from '../types';

type CbPhase = 'create-book' | 'add-words' | 'completing' | 'results' | 'done';

interface CreateBookPageProps {
  onBack: () => void;
}

export function CreateBookPage({ onBack }: CreateBookPageProps) {
  const [phase, setPhase] = useState<CbPhase>('create-book');
  const [bookName, setBookName] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [rawWords, setRawWords] = useState<string[]>([]);
  const [completeResults, setCompleteResults] = useState<WordCompleteResult[]>([]);
  const [completingProgress, setCompletingProgress] = useState({ done: 0, total: 0 });
  const [apiKey, setApiKey] = useState(() => getApiKey());
  const inputRef = useRef<HTMLInputElement>(null);

  // ===== Phase 1: 创建词书 =====
  const handleCreateBook = useCallback(() => {
    const name = bookName.trim();
    if (!name) return;
    setPhase('add-words');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [bookName]);

  // ===== Phase 2: 添加单词 =====
  const handleAddWord = useCallback(() => {
    const w = wordInput.trim().toLowerCase();
    if (!w || rawWords.includes(w)) return;
    // 简单校验：只能字母或连字符
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

  // ===== Phase 3: 开始 AI 补全 =====
  const startCompleting = useCallback(async () => {
    // 确保有 API Key
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

  // ===== Phase 4: 查看结果 & 保存 =====
  const handleSave = useCallback(() => {
    const name = bookName.trim();
    if (!name) return;

    // 收集成功的词，转成 Word[]
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

    // ★ 保存为独立词书（与雅思阅读真经同级）
    addCustomBook(name, words);
    setPhase('done');
  }, [bookName, completeResults]);

  // ===== 渲染 =====
  return (
    <div className="create-book-page">
      {/* 顶栏 */}
      <div className="create-book-nav">
        <button className="nav-back-btn" onClick={onBack}>← 返回</button>
        <span className="create-book-title">✏️ 录入词书</span>
      </div>

      {/* Phase 1: 创建词书 */}
      {phase === 'create-book' && (
        <div className="create-book-phase">
          <div className="create-book-icon">📖</div>
          <h2>录入新词书</h2>
          <p className="create-book-hint">输入词书名称，然后手动添加单词</p>
          <input
            className="create-book-input"
            type="text"
            placeholder="输入词书名称..."
            value={bookName}
            onChange={e => setBookName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateBook(); }}
            autoFocus
          />
          <button className="create-book-btn primary" onClick={handleCreateBook} disabled={!bookName.trim()}>
            创建词汇表 →
          </button>
        </div>
      )}

      {/* Phase 2: 添加单词 */}
      {phase === 'add-words' && (
        <div className="create-book-phase">
          <h2>
            📖 {bookName}
            <span className="create-book-word-count">{rawWords.length} 个词</span>
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
            </div>
          )}
        </div>
      )}

      {/* Phase 3: 补全中 */}
      {phase === 'completing' && (
        <div className="create-book-phase">
          <div className="completing-progress">
            <div className="completing-spinner" />
            <p className="completing-text">🤖 AI 正在补全单词信息...</p>
            <p className="completing-sub">
              已处理 {completingProgress.done}/{completingProgress.total} 个单词
            </p>
            <div className="completing-bar">
              <div className="completing-fill" style={{
                width: `${completingProgress.total > 0 ? (completingProgress.done / completingProgress.total * 100) : 0}%`,
              }} />
            </div>
            <p className="completing-pct">
              {completingProgress.total > 0
                ? Math.round(completingProgress.done / completingProgress.total * 100)
                : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Phase 4: 查看结果 */}
      {phase === 'results' && (
        <div className="create-book-phase">
          <h2>📖 {bookName} — 补全结果</h2>

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
              💾 保存词书（与雅思阅读真经同级）
            </button>
            <button className="create-book-btn secondary" onClick={() => setPhase('add-words')}>
              + 继续添加单词
            </button>
          </div>
        </div>
      )}

      {/* Phase 5: 完成 */}
      {phase === 'done' && (
        <div className="create-book-phase">
          <div className="create-book-icon done">✅</div>
          <h2>词书录入完成！</h2>
          <p className="create-book-hint">
            「{bookName}」已保存，共 {completeResults.filter(r => r.success).length} 个单词
          </p>
          <p className="create-book-hint">返回首页即可看到新词书，与雅思阅读真经在同一层级</p>
          <div className="create-book-actions">
            <button className="create-book-btn primary" onClick={onBack}>
              返回首页
            </button>
          </div>
        </div>
      )}

      {/* Phase 2 的空状态提示 */}
      {phase === 'add-words' && rawWords.length === 0 && (
        <p className="create-book-hint" style={{ marginTop: 24 }}>
          输入单词后点击「AI 一键补全」自动生成释义
        </p>
      )}
    </div>
  );
}
