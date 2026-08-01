import type { Word, LearningPhase } from '../types';
import { LearnCard } from './LearnCard';
import { RecallInput } from './RecallInput';
import { JudgmentResult } from './JudgmentResult';
import { useSpeak } from '../hooks/useSpeak';

interface WorkAreaProps {
  phase: LearningPhase;
  currentWord: Word | null;
  groupReviewQueue: Word[];
  groupReviewIndex: number;
  prevGroupReviewQueue: Word[];
  prevGroupReviewIndex: number;
  pageReviewQueue: Word[];
  pageReviewIndex: number;
  globalWordIndex: number;
  totalWords: number;
  judgmentResult: { correct: boolean; userInput: string; detail?: string } | null;
  isRecalling: boolean;
  isGroupReview: boolean;
  isPrevGroupReview: boolean;
  isPageReview: boolean;
  judgmentDone: boolean;
  recallKey: number;

  onFinishLearning: () => void;
  onRecallSubmit: (correct: boolean, userInput: string, detail?: string) => void;
  onContinueAfterJudgment: () => void;
  onPageDoneContinue: () => void;
}

export function WorkArea({
  phase,
  currentWord,
  groupReviewQueue,
  groupReviewIndex,
  prevGroupReviewQueue,
  prevGroupReviewIndex,
  pageReviewQueue,
  pageReviewIndex,
  globalWordIndex,
  totalWords,
  judgmentResult,
  isRecalling,
  isGroupReview,
  isPrevGroupReview,
  isPageReview,
  judgmentDone,
  recallKey,
  onFinishLearning,
  onRecallSubmit,
  onContinueAfterJudgment,
  onPageDoneContinue,
}: WorkAreaProps) {
  const { speak } = useSpeak();
  // 判断结果展示
  if (judgmentResult && !judgmentDone) {
    // ★ 根据当前阶段传入正确的 word，避免复习阶段显示最后一个学习词
    let resultWord: Word;
    if (isGroupReview && groupReviewQueue.length > 0) {
      resultWord = groupReviewQueue[groupReviewIndex];
    } else if (isPrevGroupReview && prevGroupReviewQueue.length > 0) {
      resultWord = prevGroupReviewQueue[prevGroupReviewIndex];
    } else if (isPageReview && pageReviewQueue.length > 0) {
      resultWord = pageReviewQueue[pageReviewIndex];
    } else {
      resultWord = currentWord!;
    }
    return (
      <div className="work-area">
        <JudgmentResult
          correct={judgmentResult.correct}
          word={resultWord}
          userInput={judgmentResult.userInput}
          detail={judgmentResult.detail}
          onContinue={onContinueAfterJudgment}
        />
      </div>
    );
  }

  // 写英文到A4（手写输入阶段）
  if (phase === 'write') {
    return (
      <div className="work-area">
        <div className="write-to-a4">
          <div className="write-to-a4-label">将单词写到 A4 纸 <span className="input-lang-badge">EN</span></div>
          <div className="word-to-write">
            <span className="write-word-english">{currentWord?.word}</span>
            <button
              className="speak-btn"
              onClick={(e) => { e.stopPropagation(); currentWord && speak(currentWord.word); }}
              title="点击发音"
              aria-label="播放发音"
            >
              🔊
            </button>
            <span className="write-word-pos">{currentWord?.pos}</span>
            <span className="write-word-def">{currentWord?.definition}</span>
          </div>
          <div className="write-to-a4-hint">
            <span className="progress-badge">第 {globalWordIndex + 1} / {totalWords} 词</span>
            <span>在下方 A4 纸输入英文，按 <span className="key-hint">Enter</span> 确认</span>
          </div>
        </div>
      </div>
    );
  }

  // 学习
  if (phase === 'learn' && currentWord) {
    return (
      <div className="work-area">
        <LearnCard
          word={currentWord}
          globalIndex={globalWordIndex}
          totalWords={totalWords}
          onFinish={onFinishLearning}
        />
      </div>
    );
  }

  // 回忆（单个词学习+书写后）
  if (isRecalling && currentWord) {
    return (
      <div className="work-area">
        <RecallInput
          key={`recall-${currentWord.id}-${recallKey}`}
          word={currentWord}
          mode="single"
          onJudge={onRecallSubmit}
        />
      </div>
    );
  }

  // 组复习（当前组）
  if (isGroupReview && groupReviewQueue.length > 0) {
    const reviewWord = groupReviewQueue[groupReviewIndex];
    if (!reviewWord) return null;
    return (
      <div className="work-area">
        <RecallInput
          key={`gr-${reviewWord.id}-${groupReviewIndex}-${recallKey}`}
          word={reviewWord}
          mode="group-review"
          onJudge={onRecallSubmit}
        />
      </div>
    );
  }

  // 跨组复习（上一组）
  if (isPrevGroupReview && prevGroupReviewQueue.length > 0) {
    const reviewWord = prevGroupReviewQueue[prevGroupReviewIndex];
    if (!reviewWord) return null;
    return (
      <div className="work-area">
        <RecallInput
          key={`pgr-${reviewWord.id}-${prevGroupReviewIndex}-${recallKey}`}
          word={reviewWord}
          mode="prev-group-review"
          onJudge={onRecallSubmit}
        />
      </div>
    );
  }

  // 整页复习
  if (isPageReview && pageReviewQueue.length > 0) {
    const reviewWord = pageReviewQueue[pageReviewIndex];
    if (!reviewWord) return null;
    return (
      <div className="work-area">
        <RecallInput
          key={`pr-${reviewWord.id}-${pageReviewIndex}-${recallKey}`}
          word={reviewWord}
          mode="page-review"
          onJudge={onRecallSubmit}
        />
      </div>
    );
  }

  // 一页完成 → 进入过渡页
  if (phase === 'page-done') {
    return (
      <div className="work-area">
        <div className="page-done">
          <div className="page-done-icon">✓</div>
          <div className="page-done-text">本页学习完成！</div>
          <div className="page-done-subtext">准备进入下一页</div>
          <button
            className="page-done-btn"
            onClick={onPageDoneContinue}
          >
            继续 →
          </button>
        </div>
      </div>
    );
  }

  return <div className="work-area"><div className="work-area-empty">准备开始</div></div>;
}
