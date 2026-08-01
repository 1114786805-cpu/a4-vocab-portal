/** A4 Paper 单词类型定义 (兼容 WordSense judge.ts) */

export interface Word {
  id: string;
  word: string;
  pos: string;
  definition: string;
  coreConcept: string;
  examples: string[];
  collocations?: string[];
  imageUrl?: string;
  // 兼容 WordSense judge.ts
  phonetic?: string;
  category?: string;
}

export type ErrorType =
  | 'unfamiliar'
  | 'misunderstanding'
  | 'confusion'
  | 'polysemy';

export interface AIJudgment {
  correct: boolean;
  confidence: number;
  errorType?: ErrorType;
  errorDetail?: string;
  confusedWord?: string;
  correctAnswer?: string;
}

/** 学习流程阶段 */
export type LearningPhase =
  | 'learn'        // 状态①：学习单词
  | 'write'        // 状态②：写英文到A4纸
  | 'recall'       // 状态③：回忆中文释义
  | 'group-review' // 状态④：小组复习
  | 'prev-group-review' // 跨组复习（上一组）
  | 'page-review'  // 状态⑤：整页复习
  | 'page-done';   // 一页结束，准备下一页

/** A4纸上的一个格子 */
export interface A4Slot {
  row: number;       // 第几行 (0-24)
  col: number;       // 第几列 (0-1，暂定两列)
  word: Word | null;
}

/** 当前学习状态 */
export interface LearningState {
  phase: LearningPhase;
  currentPage: number;        // 当前第几页 (0-indexed)
  currentGroup: number;       // 当前第几组 (0-4)
  currentWordInGroup: number; // 当前组内第几个词 (0-4)
  globalWordIndex: number;    // 当前页内第几个词 (0-24)
  currentWord: Word | null;   // 当前操作的单词
  a4Words: Word[];            // A4纸上已写好的单词列表
  groupReviewWords: Word[];   // 当前组复习的单词
  learningHistory: LearningHistory[];
}

export interface LearningHistory {
  wordId: string;
  correct: boolean;
  userInput: string;
  errorDetail?: string;
  timestamp: number;
}

/** 复习阶段的单词状态 */
export interface ReviewWord {
  word: Word;
  completed: boolean;
  result?: 'correct' | 'partial' | 'wrong';
  userInput?: string;
  errorDetail?: string;
}

/** 界面布局比例 */
export const LAYOUT = {
  workAreaRatio: 0.45, // 上半部分45%
  a4PaperRatio: 0.55,  // 下半部分55%
} as const;
