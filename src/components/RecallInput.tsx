import { useState, useEffect, useRef } from 'react';
import type { Word } from '../types';
import { judgeWordMeaning } from '../judge/judge';
import { useSpeak } from '../hooks/useSpeak';

interface RecallInputProps {
  word: Word;
  /** 回忆模式 */
  mode: 'single' | 'group-review' | 'prev-group-review' | 'page-review';
  onJudge: (correct: boolean, userInput: string, errorDetail?: string) => void;
}

const API_KEY_STORAGE_KEY = 'a4paper_deepseek_api_key';

/**
 * 状态③④：回忆输入框（组复习和页复习共用）
 * 用户输入中文释义，AI做语义判断
 * 
 * 流程：本地关键词秒判 → 不确定时调 DeepSeek API
 * API Key 存储在 localStorage，首次使用可设置
 */
export function RecallInput({ word, mode, onJudge }: RecallInputProps) {
  const [input, setInput] = useState('');
  const [judging, setJudging] = useState(false);
  const [judgingText, setJudgingText] = useState('');
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak } = useSpeak();

  // 自动聚焦 + 进入时自动发音
  useEffect(() => {
    inputRef.current?.focus();
    setInput('');
    setJudging(false);
    setJudgingText('');
    // 延迟一点自动发音，给页面渲染留时间
    const timer = setTimeout(() => speak(word.word), 300);
    return () => clearTimeout(timer);
  }, [word.id, mode]);

  const getApiKey = (): string | null => {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  };

  const saveApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setShowApiKeyPrompt(false);
    setApiKeyInput('');
  };

  const handleSubmit = async () => {
    if (!input.trim() || judging) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      // 没有 API Key，弹出设置窗口
      setShowApiKeyPrompt(true);
      return;
    }

    setJudging(true);
    setJudgingText('正在判断…');

    try {
      const result = await judgeWordMeaning({
        apiKey,
        word,
        userInput: input.trim(),
      });

      setJudgingText('');

      // AI判断结果 → 传给父组件
      onJudge(result.correct, input.trim(), result.errorDetail);
    } catch (e) {
      setJudgingText('');
      // 兜底：假设错误
      onJudge(false, input.trim(), 'AI判断异常');
    } finally {
      setJudging(false);
    }
  };

  // 如果正在显示API Key设置弹窗
  if (showApiKeyPrompt) {
    return (
      <div className="recall-input">
        <div className="recall-label">
          配置 AI 判断 <span className="input-lang-badge">中</span>
        </div>
        <div className="api-key-prompt">
          <p className="api-key-desc">
            需要 DeepSeek API Key 才能进行 AI 语义判断。<br />
            （已存储后不会再次询问）
          </p>
          <div className="api-key-field">
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && apiKeyInput.trim()) {
                  saveApiKey(apiKeyInput.trim());
                }
              }}
              className="api-key-input"
              placeholder="输入 DeepSeek API Key…"
              autoFocus
              autoComplete="off"
            />
            <button
              className="recall-submit-btn"
              onClick={() => saveApiKey(apiKeyInput.trim())}
              disabled={!apiKeyInput.trim()}
            >
              保存
            </button>
          </div>
          <button
            className="api-key-skip-btn"
            onClick={() => {
              // 不设置Key，用纯本地判断（弱一些但能用）
              setShowApiKeyPrompt(false);
              // 重新触发现有的handleSubmit逻辑
              setTimeout(() => {
                if (!input.trim()) return;
                // 直接走本地逻辑
                setJudging(true);
                setTimeout(() => {
                  setJudging(false);
                  // 用简单关键词匹配
                  const userInput = input.trim().toLowerCase();
                  const def = word.definition.toLowerCase();
                  const match = def.includes(userInput) || userInput.split(/\s+/).some((t: string) => t.length >= 2 && def.includes(t));
                  onJudge(match, input.trim(), match ? undefined : `更准确的释义是：${word.definition}`);
                }, 300);
              }, 100);
            }}
          >
            跳过，仅本地判断
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recall-input">
      <div className="recall-label">
        {mode === 'single' ? '请输入中文释义' : mode === 'group-review' ? '组复习' : mode === 'prev-group-review' ? '跨组复习' : '整页复习'}
        <span className="input-lang-badge" style={{ marginLeft: 8 }}>中</span>
      </div>

      <div className="recall-word-display">
        <span className="recall-word">{word.word}</span>
        <button
          className="speak-btn recall-speak-btn"
          onClick={(e) => { e.stopPropagation(); speak(word.word); }}
          title="点击发音"
          aria-label="播放发音"
        >
          🔊
        </button>
        <span className="recall-pos">{word.pos}</span>
      </div>

      <div className="recall-field">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSubmit();
          }}
          className="recall-text-input"
          placeholder={
            mode === 'single'
              ? '输入中文释义…'
              : mode === 'group-review'
                ? '回忆该词的中文释义…'
                : '整页复习，输入中文释义…'
          }
          disabled={judging}
          autoComplete="off"
          inputMode="text"
          lang="zh-CN"
        />
        <button
          className="recall-submit-btn"
          onClick={handleSubmit}
          disabled={judging || !input.trim()}
        >
          {judging ? '判断中...' : '判断'}
        </button>
      </div>

      {judging && judgingText && (
        <div className="recall-judging">
          <span className="judging-spinner" />
          <span>{judgingText}</span>
        </div>
      )}

      <div className="recall-hint">
        <span className="key-hint">Enter</span> 提交判断
      </div>
    </div>
  );
}
