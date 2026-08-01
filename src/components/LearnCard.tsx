import { useEffect } from 'react';
import type { Word } from '../types';
import { useSpeak } from '../hooks/useSpeak';

interface LearnCardProps {
  word: Word;
  globalIndex: number;
  totalWords: number;
  onFinish: () => void;
}

/**
 * 状态①：学习卡片 — 横向紧凑排列
 * 充分利用横屏空间：单词、释义、词根词缀、例句全部横向展示
 */
export function LearnCard({ word, globalIndex, totalWords, onFinish }: LearnCardProps) {
  const { speak } = useSpeak();

  // 进入时自动播放发音
  useEffect(() => {
    speak(word.word);
  }, [word.word, speak]);

  // 全局 Enter 监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onFinish();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFinish]);

  return (
    <div className="learn-card">
      {/* 顶部进度条 */}
      <div className="learn-card-progress">
        <div className="progress-text">
          第 {globalIndex + 1} / {totalWords} 词
        </div>
      </div>

      {/* 第一行：单词 + 发音按钮 + 词性 + 释义 横向 */}
      <div className="learn-card-word-section">
        <span className="learn-card-word">{word.word}</span>
        <button
          className="speak-btn"
          onClick={(e) => { e.stopPropagation(); speak(word.word); }}
          title="点击发音"
          aria-label="播放发音"
        >
          🔊
        </button>
        <span className="learn-card-pos">{word.pos}</span>
        <span className="learn-card-definition">{word.definition}</span>
      </div>

      {/* 信息网格：核心概念 + 词根词缀信息 */}
      <div className="learn-card-info-grid">
        {/* 核心概念 */}
        {word.coreConcept && (
          <div className="learn-card-info-item">
            <div className="learn-card-info-label">核心概念</div>
            <div className="learn-card-info-content">{word.coreConcept}</div>
          </div>
        )}

        {/* 例句 - 取第一个最简例句 */}
        {word.examples.length > 0 && (
          <div className="learn-card-info-item">
            <div className="learn-card-info-label">例句</div>
            <div className="learn-card-info-content">{word.examples[0]}</div>
          </div>
        )}

        {/* 常用搭配 */}
        {word.collocations && word.collocations.length > 0 && (
          <div className="learn-card-info-item">
            <div className="learn-card-info-label">搭配</div>
            <div className="learn-card-info-content">{word.collocations.join(' · ')}</div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="learn-card-footer">
        <span className="key-hint">Enter</span> 记住后继续
      </div>
    </div>
  );
}
