import { useEffect } from 'react';
import type { Word } from '../types';
import { useSpeak } from '../hooks/useSpeak';

interface JudgmentResultProps {
  correct: boolean;
  word: Word;
  userInput: string;
  detail?: string;
  onContinue: () => void;
}

/**
 * 判断结果展示
 * 正确 → 快速闪过，自动进入下一步
 * 错误 → 显示正确答案
 */
export function JudgmentResult({ correct, word, userInput, detail, onContinue }: JudgmentResultProps) {
  const { speak } = useSpeak();

  // 错误时自动发音，帮助加深印象
  useEffect(() => {
    if (!correct) {
      speak(word.word);
    }
  }, [correct, word.word, speak]);
  // 正确时自动继续，错误时等待 Enter
  useEffect(() => {
    if (correct) {
      const timer = setTimeout(onContinue, 500);
      return () => clearTimeout(timer);
    }
  }, [correct, onContinue]);

  useEffect(() => {
    if (!correct) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onContinue();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [correct, onContinue]);

  return (
    <div className={`judgment-result ${correct ? 'correct' : 'wrong'}`}>
      <div className="judgment-icon">{correct ? '✓' : '✗'}</div>

      <div className="judgment-word">
        {word.word} <span className="judgment-pos">{word.pos}</span>
        <button
          className="speak-btn speak-btn-sm"
          onClick={(e) => { e.stopPropagation(); speak(word.word); }}
          title="点击发音"
          aria-label="播放发音"
        >
          🔊
        </button>
      </div>

      {!correct && (
        <div className="judgment-details">
          <div className="judgment-your-answer">
            你输入：<span className="your-answer-text">{userInput}</span>
          </div>
          {detail && (
            <div className="judgment-detail">
              {detail}
            </div>
          )}
          <div className="judgment-correct-answer">
            <span className="correct-label">正确答案：</span>
            <span className="correct-text">{word.definition}</span>
          </div>
          <div className="judgment-footer">
            <span className="key-hint">Enter</span> 再次输入
          </div>
        </div>
      )}

      {correct && (
        <div className="judgment-correct-result">
          <span className="correct-text">{word.definition}</span>
          <div className="judgment-auto-next">自动继续…</div>
        </div>
      )}
    </div>
  );
}
