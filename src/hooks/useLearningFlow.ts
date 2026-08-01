import { useState, useCallback, useEffect } from 'react';
import type { Word, LearningPhase, LearningHistory } from '../types';

export interface LearningFlowState {
  phase: LearningPhase;
  currentGroup: number;      // 0-4
  currentWordInGroup: number; // 0-4
  globalWordIndex: number;    // 0-24
  currentWord: Word | null;
  a4Words: Word[];            // 已经成功写到A4纸上的单词

  // A4纸手写状态
  a4WriteTarget: Word | null;  // 当前需要手写的单词
  a4SlotIndex: number;         // 当前组内第几个slot（0-4），控制A4纸高亮

  // 组复习（复习当前组）
  groupReviewQueue: Word[];
  groupReviewIndex: number;

  // 跨组复习（复习上一组）
  prevGroupReviewQueue: Word[];
  prevGroupReviewIndex: number;

  // 整页复习
  pageReviewQueue: Word[];
  pageReviewIndex: number;

  // 历史
  history: LearningHistory[];
  errorWords: { word: Word; detail: string }[];
}

export function useLearningFlow(pageWords: Word[], startDirectReview = false, initialA4Words: Word[] = []) {
  const PAGE_SIZE = 25;
  const GROUP_SIZE = 5;

  // ★ 根据 initialA4Words 算出应该从哪里继续学（跳过已学过的词）
  const computeStartIndex = (() => {
    if (startDirectReview) {
      // 整页复习模式：不受跳过影响，下面单独处理
      return { skip: false, startIndex: 0 };
    }
    if (initialA4Words.length > 0 && pageWords.length > 0) {
      // 有已保存的 A4 词 → 跳过这些词，从下一个组继续
      // 说明：A4 词按组写入，一组写完才走下一组。initialA4Words.length 是已学完整的词数
      return { skip: true, startIndex: initialA4Words.length };
    }
    return { skip: false, startIndex: 0 };
  })();

  const [state, setState] = useState<LearningFlowState>(() => {
    if (startDirectReview && pageWords.length > 0) {
      return {
        phase: 'page-review' as const,
        currentGroup: 0,
        currentWordInGroup: 0,
        globalWordIndex: 0,
        currentWord: pageWords[0],
        a4Words: initialA4Words.length > 0 ? initialA4Words : pageWords,
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: initialA4Words.length > 0 ? initialA4Words : pageWords,
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      };
    }
    // ★ 如果之前已学过一些词，跳过它们从下一个词继续学
    if (computeStartIndex.skip && computeStartIndex.startIndex < pageWords.length) {
      const startIdx = computeStartIndex.startIndex;
      const group = Math.floor(startIdx / GROUP_SIZE);
      const wordInGroup = startIdx % GROUP_SIZE;
      return {
        phase: 'learn' as const,
        currentGroup: group,
        currentWordInGroup: wordInGroup,
        globalWordIndex: startIdx,
        currentWord: pageWords[startIdx],
        a4Words: [...initialA4Words],
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: [],
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      };
    }
    return {
      phase: 'learn' as const,
      currentGroup: 0,
      currentWordInGroup: 0,
      globalWordIndex: 0,
      currentWord: pageWords[0] || null,
      a4Words: startDirectReview ? initialA4Words : [],
      a4WriteTarget: null,
      a4SlotIndex: 0,
      groupReviewQueue: [],
      groupReviewIndex: 0,
      prevGroupReviewQueue: [],
      prevGroupReviewIndex: 0,
      pageReviewQueue: [],
      pageReviewIndex: 0,
      history: [],
      errorWords: [],
    };
  });

  // pageWords 变化时自动重置状态（替换 sessionKey 强制重建方案）
  useEffect(() => {
    if (startDirectReview && pageWords.length > 0) {
      setState({
        phase: 'page-review',
        currentGroup: 0,
        currentWordInGroup: 0,
        globalWordIndex: 0,
        currentWord: pageWords[0],
        a4Words: initialA4Words.length > 0 ? initialA4Words : pageWords,
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: initialA4Words.length > 0 ? initialA4Words : pageWords,
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    } else if (computeStartIndex.skip && computeStartIndex.startIndex < pageWords.length) {
      // ★ 从上次断点继续（有已保存的 A4 词）
      const startIdx = computeStartIndex.startIndex;
      const group = Math.floor(startIdx / GROUP_SIZE);
      const wordInGroup = startIdx % GROUP_SIZE;
      setState({
        phase: 'learn',
        currentGroup: group,
        currentWordInGroup: wordInGroup,
        globalWordIndex: startIdx,
        currentWord: pageWords[startIdx],
        a4Words: [...initialA4Words],
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: [],
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    } else {
      setState({
        phase: 'learn',
        currentGroup: 0,
        currentWordInGroup: 0,
        globalWordIndex: 0,
        currentWord: pageWords[0] || null,
        a4Words: startDirectReview ? initialA4Words : [],
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: [],
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    }
  }, [pageWords, startDirectReview]);

  const getGroupWords = useCallback((groupIndex: number): Word[] => {
    const start = groupIndex * GROUP_SIZE;
    return pageWords.slice(start, start + GROUP_SIZE);
  }, [pageWords]);

  /** 学习完成 → 进入手写A4状态 */
  const finishLearning = useCallback(() => {
    const cur = state.currentWord;
    if (!cur || state.phase !== 'learn') return;
    setState(prev => ({
      ...prev,
      phase: 'write',
      a4WriteTarget: cur,
    }));
  }, [state.phase, state.currentWord]);

  /** 用户在A4纸的输入框中按Enter，确认这个词写到A4上 */
  const confirmA4Input = useCallback((inputText: string): { success: boolean; error?: string } => {
    const target = state.a4WriteTarget;
    if (!target || state.phase !== 'write') return { success: false, error: '没有待写的单词' };

    const normalized = inputText.trim().toLowerCase();
    const expected = target.word.trim().toLowerCase();

    if (normalized !== expected) {
      return { success: false, error: `拼写错误：期望 "${target.word}"，实际输入 "${inputText.trim()}"` };
    }

    const newA4Words = [...state.a4Words, target];
    setState(prev => ({
      ...prev,
      a4Words: newA4Words,
      a4WriteTarget: null,
      phase: 'recall',
    }));
    return { success: true };
  }, [state.phase, state.a4WriteTarget, state.a4Words]);

  /** 回忆/判断完成 → 进入下一步 */
  const completeRecall = useCallback((correct: boolean, userInput: string, errorDetail?: string) => {
    const curWord = state.currentWord;
    if (!curWord) return;

    const newHistory: LearningHistory = {
      wordId: curWord.id,
      correct,
      userInput,
      errorDetail,
      timestamp: Date.now(),
    };

    setState(prev => {
      const history = [...prev.history, newHistory];
      const errorWords = correct
        ? prev.errorWords
        : [...prev.errorWords, { word: curWord, detail: errorDetail || '释义错误' }];

      const nextWordInGroup = prev.currentWordInGroup + 1;
      const nextGlobal = prev.globalWordIndex + 1;
      const totalInPage = Math.min(PAGE_SIZE, pageWords.length);

      // 组内最后一词完成 → 进入该组的复习
      if (nextWordInGroup >= GROUP_SIZE) {
        const currentGroupWords = getGroupWords(prev.currentGroup);

        // 进入本组复习
        return {
          ...prev,
          phase: 'group-review' as const,
          groupReviewQueue: currentGroupWords,
          groupReviewIndex: 0,
          history,
          errorWords,
        };
      }

      // 组内继续 → 进入下一个词的学习
      return {
        ...prev,
        phase: 'learn' as const,
        currentWordInGroup: nextWordInGroup,
        globalWordIndex: nextGlobal,
        currentWord: pageWords[nextGlobal],
        history,
        errorWords,
      };
    });
  }, [state.currentWord, state.currentWordInGroup, state.globalWordIndex, getGroupWords, pageWords]);

  /** 组复习中的一个词完成 */
  const completeGroupReviewItem = useCallback(() => {
    setState(prev => {
      const nextIdx = prev.groupReviewIndex + 1;

      if (nextIdx >= prev.groupReviewQueue.length) {
        const nextGlobal = prev.a4Words.length;
        const totalInPage = Math.min(PAGE_SIZE, pageWords.length);

        // 进入跨组复习（复习上一组）
        if (prev.currentGroup > 0) {
          const prevGroupIdx = prev.currentGroup - 1;
          const prevGroupWords = getGroupWords(prevGroupIdx);
          return {
            ...prev,
            phase: 'prev-group-review' as const,
            groupReviewQueue: [],
            groupReviewIndex: 0,
            prevGroupReviewQueue: prevGroupWords,
            prevGroupReviewIndex: 0,
          };
        }

        // 第一组复习完成 → 下一组学习
        const nextGroup = prev.currentGroup + 1;
        return {
          ...prev,
          phase: 'learn' as const,
          currentGroup: nextGroup,
          currentWordInGroup: 0,
          globalWordIndex: nextGlobal,
          currentWord: pageWords[nextGlobal],
          groupReviewQueue: [],
          groupReviewIndex: 0,
        };
      }

      return {
        ...prev,
        groupReviewIndex: nextIdx,
      };
    });
  }, [getGroupWords, pageWords]);

  /** 跨组复习中的一个词完成 */
  const completePrevGroupReviewItem = useCallback(() => {
    setState(prev => {
      const nextIdx = prev.prevGroupReviewIndex + 1;

      if (nextIdx >= prev.prevGroupReviewQueue.length) {
        const nextGroup = prev.currentGroup + 1;
        const nextGlobal = prev.a4Words.length;
        const totalInPage = Math.min(PAGE_SIZE, pageWords.length);

        // 还有下一组 → 进入下一组学习
        if (nextGroup < totalInPage / GROUP_SIZE) {
          return {
            ...prev,
            phase: 'learn' as const,
            currentGroup: nextGroup,
            currentWordInGroup: 0,
            globalWordIndex: nextGlobal,
            currentWord: pageWords[nextGlobal],
            prevGroupReviewQueue: [],
            prevGroupReviewIndex: 0,
          };
        }

        // 全部学完 → 进入整页复习
        return {
          ...prev,
          phase: 'page-review' as const,
          pageReviewQueue: [...prev.a4Words],
          pageReviewIndex: 0,
          prevGroupReviewQueue: [],
          prevGroupReviewIndex: 0,
        };
      }

      return {
        ...prev,
        prevGroupReviewIndex: nextIdx,
      };
    });
  }, [pageWords]);

  /** 整页复习中的一个词完成 */
  const completePageReviewItem = useCallback(() => {
    setState(prev => {
      const nextIdx = prev.pageReviewIndex + 1;
      if (nextIdx >= prev.pageReviewQueue.length) {
        return { ...prev, phase: 'page-done' as const };
      }
      return { ...prev, pageReviewIndex: nextIdx };
    });
  }, []);

  const reset = useCallback(() => {
    if (startDirectReview && pageWords.length > 0) {
      setState({
        phase: 'page-review',
        currentGroup: 0,
        currentWordInGroup: 0,
        globalWordIndex: 0,
        currentWord: pageWords[0],
        a4Words: initialA4Words.length > 0 ? initialA4Words : pageWords,
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: initialA4Words.length > 0 ? initialA4Words : pageWords,
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    } else if (computeStartIndex.skip && computeStartIndex.startIndex < pageWords.length) {
      const startIdx = computeStartIndex.startIndex;
      const group = Math.floor(startIdx / GROUP_SIZE);
      const wordInGroup = startIdx % GROUP_SIZE;
      setState({
        phase: 'learn',
        currentGroup: group,
        currentWordInGroup: wordInGroup,
        globalWordIndex: startIdx,
        currentWord: pageWords[startIdx],
        a4Words: [...initialA4Words],
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: [],
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    } else {
      setState({
        phase: 'learn',
        currentGroup: 0,
        currentWordInGroup: 0,
        globalWordIndex: 0,
        currentWord: pageWords[0] || null,
        a4Words: startDirectReview ? initialA4Words : [],
        a4WriteTarget: null,
        a4SlotIndex: 0,
        groupReviewQueue: [],
        groupReviewIndex: 0,
        prevGroupReviewQueue: [],
        prevGroupReviewIndex: 0,
        pageReviewQueue: [],
        pageReviewIndex: 0,
        history: [],
        errorWords: [],
      });
    }
  }, [pageWords, startDirectReview, initialA4Words]);

  return {
    state,
    finishLearning,
    confirmA4Input,
    completeRecall,
    completeGroupReviewItem,
    completePrevGroupReviewItem,
    completePageReviewItem,
    reset,
    pageWords,
  };
}
