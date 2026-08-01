import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { Word, LearningPhase } from '../types';

type WordMark = 'correct' | 'wrong';

interface A4PaperProps {
  words: Word[];
  phase: LearningPhase;
  a4GroupIndex: number;        // 当前在第几组（0-4），控制显示哪个组的输入框
  a4SlotIndex: number;         // 当前组内第几个slot（0-4）
  a4WriteTarget: Word | null;  // 当前需要手写的单词
  onA4InputSubmit: (text: string) => { success: boolean; error?: string };
  /** 复习标记：key=word.id, value='correct' | 'wrong'，仅在复习阶段生效 */
  reviewMarks: Record<string, WordMark>;
}

/**
 * 下半部分：纯白A4纸
 * 无横线，一组5个词（上行3个，下行2个），共5组10行，居中分布
 * 
 * 绿点规则：
 * - 第一次学习（learn → write → recall 阶段）：不标任何点
 * - 组复习 / 整页复习阶段：答对标绿点✅，答错标红点❌（鼠标悬停显示正确释义）
 */
export function A4Paper({
  words,
  phase,
  a4GroupIndex,
  a4SlotIndex,
  a4WriteTarget,
  onA4InputSubmit,
  reviewMarks = {},
}: A4PaperProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [spellingError, setSpellingError] = useState<string | null>(null);

  // 每当组索引变化时自动滚动到A4纸底部（让最新组可见）
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [a4GroupIndex]);

  // write阶段自动focus输入框，清除上次错误

  // 判断当前是否是复习阶段（组复习或整页复习）
  const isReviewPhase = phase === 'group-review' || phase === 'page-review';

  // write阶段自动focus输入框，清除上次错误
  useEffect(() => {
    if (phase === 'write' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.value = '';
      setSpellingError(null);
    }
  }, [phase, a4GroupIndex, a4SlotIndex]);

  // 拼写错误提示的自动清除定时
  useEffect(() => {
    if (spellingError) {
      const t = setTimeout(() => setSpellingError(null), 2500);
      return () => clearTimeout(t);
    }
  }, [spellingError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value.trim();
      if (!val) return;
      setSpellingError(null);
      const result = onA4InputSubmit(val);
      if (!result.success && result.error) {
        setSpellingError(result.error);
        (e.target as HTMLInputElement).focus();
        (e.target as HTMLInputElement).select();
      }
    }
  }, [onA4InputSubmit]);

  // 构建A4纸上的内容
  const groups = useMemo(() => {
    const slots: Array<Array<{
      type: 'filled' | 'empty' | 'input';
      word: Word | null;
      wordText: string;
      markType: WordMark | null;  // 复习标记：'correct' | 'wrong' | null
    } | null>> = [];
    for (let gi = 0; gi < 5; gi++) {
      const group: Array<{
        type: 'filled' | 'empty' | 'input';
        word: Word | null;
        wordText: string;
        markType: WordMark | null;
      } | null> = [];
      const groupStart = gi * 5;

      for (let si = 0; si < 5; si++) {
        const wordIndex = groupStart + si;

        // 如果当前位置是正在写的输入框
        if (
          phase === 'write' &&
          gi === a4GroupIndex &&
          si === a4SlotIndex &&
          a4WriteTarget
        ) {
          group.push({
            type: 'input',
            word: a4WriteTarget,
            wordText: '',
            markType: null,
          });
          continue;
        }

        // 如果这个词已经写到A4上了
        if (wordIndex < words.length) {
          const w = words[wordIndex];
          const mark = isReviewPhase && reviewMarks[w.id] ? reviewMarks[w.id] : null;
          group.push({
            type: 'filled',
            word: w,
            wordText: w.word,
            markType: mark,
          });
        } else {
          group.push(null);
        }
      }
      slots.push(group);
    }
    return slots;
  }, [words, phase, a4GroupIndex, a4SlotIndex, a4WriteTarget, reviewMarks, isReviewPhase]);

  const renderInput = (key: string) => (
    <div key={key} className="a4-slot a4-slot-input-wrapper">
      <span className="a4-input-lang-hint">A/a</span>
      <input
        ref={inputRef}
        type="text"
        className="a4-slot-input"
        placeholder=""
        onKeyDown={handleKeyDown}
        onChange={spellingError ? () => setSpellingError(null) : undefined}
        autoComplete="off"
        inputMode="text"
        lang="en"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {spellingError && (
        <div className="a4-spelling-error">
          ✗ {spellingError.replace('拼写错误：', '')}
        </div>
      )}
    </div>
  );

  return (
    <div className="a4-paper-wrapper">
      <div className="a4-paper">
        {/* A4纸头部 - 极简 */}
        <div className="a4-header-slim">
          <span className="a4-header-count">{words.length} / 25</span>
        </div>

        {/* 正文 - 可滚动的组列表 */}
        <div ref={bodyRef} className="a4-body">
          {groups.map((group, gi) => {
            return (
              <div key={gi} className="a4-group">
                {/* 第一行：3个词 */}
                <div className="a4-row">
                  {[0, 1, 2].map((pos) => {
                    const slot = group[pos];
                    if (!slot) return <div key={pos} className="a4-slot empty" />;
                    if (slot.type === 'input') return renderInput('input');
                    return (
                      <div
                        key={`filled-${slot.word?.id || pos}`}
                        className={`a4-slot filled ${slot.markType === 'correct' ? 'a4-slot-correct' : ''} ${slot.markType === 'wrong' ? 'a4-slot-wrong' : ''}`}
                        title={slot.markType === 'wrong' && slot.word ? `${slot.word.word} — ${slot.word.pos} ${slot.word.definition}${slot.word.examples && slot.word.examples[0] ? '\n\n📖 ' + slot.word.examples[0] : ''}` : ''}
                      >
                        <span className="a4-slot-text">{slot.wordText}</span>
                        {slot.markType === 'correct' && <span className="a4-slot-dot a4-slot-dot-correct" />}
                        {slot.markType === 'wrong' && <span className="a4-slot-dot a4-slot-dot-wrong" />}
                      </div>
                    );
                  })}
                </div>
                {/* 第二行：2个词 */}
                <div className="a4-row a4-row-shift">
                  {[3, 4].map((pos) => {
                    const slot = group[pos];
                    if (!slot) return <div key={pos} className="a4-slot empty" />;
                    if (slot.type === 'input') return renderInput('input-2');
                    return (
                      <div
                        key={`filled-${slot.word?.id || pos}`}
                        className={`a4-slot filled ${slot.markType === 'correct' ? 'a4-slot-correct' : ''} ${slot.markType === 'wrong' ? 'a4-slot-wrong' : ''}`}
                        title={slot.markType === 'wrong' && slot.word ? `${slot.word.word} — ${slot.word.pos} ${slot.word.definition}${slot.word.examples && slot.word.examples[0] ? '\n\n📖 ' + slot.word.examples[0] : ''}` : ''}
                      >
                        <span className="a4-slot-text">{slot.wordText}</span>
                        {slot.markType === 'correct' && <span className="a4-slot-dot a4-slot-dot-correct" />}
                        {slot.markType === 'wrong' && <span className="a4-slot-dot a4-slot-dot-wrong" />}
                      </div>
                    );
                  })}
                  {/* 第二行居中两个词后还有一个占位 */}
                  <div className="a4-slot empty" />
                </div>
                {/* ★ 组进度绿点已移除，只保留单词后的绿点 */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
