import type { Word } from './types';
import type { WordBook } from './data/bookData';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { A4Paper } from './components/A4Paper';
import { WorkArea } from './components/WorkArea';
import { HomePage } from './components/HomePage';
import { CreateBookPage } from './components/CreateBookPage';
import { ArticleListPage } from './components/ArticleListPage';
import { useLearningFlow } from './hooks/useLearningFlow';
import { getBookById } from './data/bookData';
import { getArticleById, getArticlePageWords, getArticleTotalPages } from './data/readingStore';
import { markPageCompleted, savePageErrorWords, savePageHistory, saveA4Words, getA4Words, clearA4Words, saveReadingA4Words, getReadingA4Words, clearReadingA4Words } from './store/persistStore';
import { markWordMastered, markWordWrong, shouldPageReview, incrementReviewRound, restoreMasteryFromBackend } from './store/progressStore';
import { restoreReadingFromBackend } from './data/readingStore';
import { restoreProgressFromBackend } from './store/persistStore';
import { restorePhrasesFromBackend, getPhraseSyncResult } from './data/phraseStore';
import { PhraseBookPage } from './components/PhraseBookPage';
import SyncSettingsPage from './components/SyncSettingsPage';
import { AbyssPortal } from './components/AbyssPortal';
import { getStoredToken, pullFromGist, pullFromGistAnonymous } from './data/gistSync';
import SaveStatusToast from './components/SaveStatusToast';
import './App.css';

type AppView = 'home' | 'learning' | 'reading-learning' | 'page-transition' | 'create-book' | 'reading' | 'phrasebook' | 'sync-settings' | 'abyss';

function App() {
  const [view, setView] = useState<AppView>('home');
  const [selectedBook, setSelectedBook] = useState<{ bookId: string; pageIndex: number } | null>(null);
  // ★ 阅读篇目学习：直接存单词数组（不走 selectedBook 的分页逻辑）
  const [readingLearning, setReadingLearning] = useState<{
    articleId: string;
    title: string;
    pageIndex: number;
    totalPages: number;
  } | null>(null);
  // ★ 是否直接进入整页复习（已有history，再次进页）
  const [isDirectReview, setIsDirectReview] = useState(false);
  const [restoring, setRestoring] = useState(true); // 正在从后端恢复数据

  // 启动时：从 localStorage 恢复
  useEffect(() => {
    let cancelled = false;
    async function localRestore() {
      // 先从 Gist 拉取
      const storedToken = getStoredToken();
      if (storedToken) {
        // 有 Token：完整同步（拉取 + 推送）
        const syncResult = await pullFromGist(storedToken).catch(() => ({ pulled: false, pushed: false, message: '', error: undefined }));
        if (syncResult.pulled) {
          console.log('[Gist] 已从云端拉取最新数据');
        }
      } else {
        // 无 Token：匿名拉取（仅读取，因为 Gist 公开可读）
        const syncResult = await pullFromGistAnonymous().catch(() => ({ pulled: false, message: '' }));
        if (syncResult.pulled) {
          console.log('[Gist] 已匿名从云端拉取数据');
        }
      }

      await restoreProgressFromBackend().catch(() => {});
      await restoreMasteryFromBackend().catch(() => {});
      await restoreReadingFromBackend().catch(() => {});
      await restorePhrasesFromBackend().catch(() => {});

      if (!cancelled) setRestoring(false);
    }
    localRestore();
    return () => { cancelled = true; };
  }, []);

  // 根据选中的词书和页码获取单词（分页：每页25词）
  const pageWords = useMemo(() => {
    if (!selectedBook) return [];
    const { pageIndex } = selectedBook;
    const start = pageIndex * 25;
    // 查内置词书或自建词书
    const book = getBookById(selectedBook.bookId);
    if (book) return book.words.slice(start, start + 25);
    return [];
  }, [selectedBook]);

  // ★ 阅读篇目学习：当前页的单词
  const readingLearningWords = useMemo(() => {
    if (!readingLearning) return [];
    return getArticlePageWords(readingLearning.articleId, readingLearning.pageIndex);
  }, [readingLearning]);

  // 从 localStorage 恢复 a4Words（关掉页面再打开不丢失手写进度）
  const initialA4Words = useMemo(() => {
    if (selectedBook) {
      return getA4Words(selectedBook.bookId, selectedBook.pageIndex);
    }
    if (readingLearning) {
      return getReadingA4Words(readingLearning.articleId, readingLearning.pageIndex);
    }
    return [];
  }, [selectedBook, readingLearning]);

  const flow = useLearningFlow(pageWords, isDirectReview, initialA4Words);
  // ★ 阅读篇目学习 flow（读取保存的A4词）
  const readingFlow = useLearningFlow(readingLearningWords, isDirectReview, initialA4Words);
  const {
    state,
    finishLearning,
    confirmA4Input,
    completeRecall,
    completeGroupReviewItem,
    completePrevGroupReviewItem,
    completePageReviewItem,
  } = view === 'reading-learning' ? readingFlow : flow;

  const [judgmentResult, setJudgmentResult] = useState<{
    correct: boolean;
    userInput: string;
    detail?: string;
  } | null>(null);
  const [judgmentDone, setJudgmentDone] = useState(false);
  const [recallKey, setRecallKey] = useState(0);
  const [pageTransitionVisible, setPageTransitionVisible] = useState(false);

  // ★ 复习标记（A4纸上显示绿/红点用）
  const [reviewMarks, setReviewMarks] = useState<Record<string, 'correct' | 'wrong'>>({});

  // ★ A4词持久化：每次 a4Words 变化时保存到 localStorage
  useEffect(() => {
    if (state.a4Words.length === 0) return;
    if (selectedBook) {
      saveA4Words(selectedBook.bookId, selectedBook.pageIndex, state.a4Words);
    } else if (readingLearning) {
      saveReadingA4Words(readingLearning.articleId, readingLearning.pageIndex, state.a4Words);
    }
  }, [state.a4Words, selectedBook, readingLearning]);

  // ★ activeWord ref — 用于持久化 hook 中引用，避免 const hoisting 问题

  // ★ activeWord ref — 用于持久化 hook 中引用，避免 const hoisting 问题
  const activeWordRef = useRef<Word | null>(null);

  // ★ 新建词书（手动输入）
  const handleCreateBook = useCallback(() => {
    setView('create-book');
  }, []);

  const handleOpenReading = useCallback(() => {
    setView('reading');
  }, []);

  const handleOpenPhraseBook = useCallback(() => {
    setView('phrasebook');
  }, []);

  const handleOpenSyncSettings = useCallback(() => {
    setView('sync-settings');
  }, []);

  const handleOpenAbyss = useCallback(() => {
    setView('abyss');
  }, []);

  const handleExitAbyss = useCallback(() => {
    setView('home');
  }, []);

  const handleStartLearning = useCallback((bookId: string, pageIndex: number) => {
    const isReview = shouldPageReview(bookId, pageIndex);
    setSelectedBook({ bookId, pageIndex });
    setIsDirectReview(isReview);
    // ★ 只有首次进入（没有已保存的A4词）才清缓存
    // 如果之前学过中途退出，A4词还留着，不清 → 恢复进度
    if (!isReview) {
      const existing = getA4Words(bookId, pageIndex);
      if (existing.length === 0) clearA4Words(bookId, pageIndex);
    }
    setReviewMarks({});     // ★ 重置复习标记
    setJudgmentResult(null);
    setJudgmentDone(false);
    setRecallKey(0);
    setView('learning');
  }, []);

  // ★ 阅读篇目学习入口
  const handleStartReadingLearning = useCallback((articleId: string, pageIndex: number = 0) => {
    const article = getArticleById(articleId);
    if (!article || article.words.length === 0) return;
    const totalPages = getArticleTotalPages(articleId);
    const readingBookId = `reading_${articleId}`;
    const isReview = shouldPageReview(readingBookId, pageIndex);
    setReadingLearning({ articleId, title: article.title, pageIndex, totalPages });
    setIsDirectReview(isReview);
    // ★ 只有首次进入（没有已保存的A4词）才清缓存
    if (!isReview) {
      const existing = getReadingA4Words(articleId, pageIndex);
      if (existing.length === 0) clearReadingA4Words(articleId, pageIndex);
    }
    setReviewMarks({});
    setJudgmentResult(null);
    setJudgmentDone(false);
    setRecallKey(0);
    setView('reading-learning');
  }, []);

  // 返回首页 或 返回阅读篇目列表
  const goHome = useCallback(() => {
    if (selectedBook && state.a4Words.length > 0) {
      // ★ 保存进度：page-done 时标记复习就绪；中途退出只保 A4 词（已自动存）
      if (state.phase === 'page-done') {
        incrementReviewRound(selectedBook.bookId, selectedBook.pageIndex);
        markPageCompleted(selectedBook.bookId, selectedBook.pageIndex);
      }
      if (state.errorWords.length > 0) {
        savePageErrorWords(selectedBook.bookId, selectedBook.pageIndex, state.errorWords.map(ew => ({
          word: ew.word,
          userInput: '',
          errorDetail: ew.detail,
        })));
      }
      savePageHistory(selectedBook.bookId, selectedBook.pageIndex, state.history);
    }
    setView('home');
    setSelectedBook(null);
    setReadingLearning(null);
    setJudgmentResult(null);
    setJudgmentDone(false);
    setRecallKey(0);
  }, [selectedBook, state.phase, state.a4Words, state.errorWords, state.history]);

  // ★ 返回阅读生词簿（篇目列表）
  const goToReadingList = useCallback(() => {
    // 离开前保存 A4 词和错词/历史（学完或中途退出都保存）
    if (readingLearning && state.a4Words.length > 0) {
      const readingBookId = `reading_${readingLearning.articleId}`;
      // ★ 只有真正学完一页（page-done）才标记整页复习就绪
      //   中途退出只保存 A4 词，下次进来可恢复进度继续学
      if (state.phase === 'page-done') {
        incrementReviewRound(readingBookId, readingLearning.pageIndex);
        markPageCompleted(readingBookId, readingLearning.pageIndex);
      }
      if (state.errorWords.length > 0) {
        savePageErrorWords(readingBookId, readingLearning.pageIndex, state.errorWords.map(ew => ({
          word: ew.word,
          userInput: '',
          errorDetail: ew.detail,
        })));
      }
      savePageHistory(readingBookId, readingLearning.pageIndex, state.history);
    }
    setView('reading');
    setReadingLearning(null);
    setSelectedBook(null);
    setJudgmentResult(null);
    setJudgmentDone(false);
    setRecallKey(0);
  }, [readingLearning, state.phase, state.errorWords, state.history]);

  // 保存当前页学习数据并进入下一页
  const advanceToNextPage = useCallback(() => {
    if (view === 'reading-learning' && readingLearning) {
      // ★ 阅读篇目的进阶逻辑 + 进度持久化
      const readingBookId = `reading_${readingLearning.articleId}`;

      // 初次学完一页时标记为复习就绪
      incrementReviewRound(readingBookId, readingLearning.pageIndex);

      // 持久化：标记当前页完成 + 保存错词和历史
      markPageCompleted(readingBookId, readingLearning.pageIndex);
      if (state.errorWords.length > 0) {
        savePageErrorWords(readingBookId, readingLearning.pageIndex, state.errorWords.map(ew => ({
          word: ew.word,
          userInput: '',
          errorDetail: ew.detail,
        })));
      }
      savePageHistory(readingBookId, readingLearning.pageIndex, state.history);

      const nextPage = readingLearning.pageIndex + 1;
      if (nextPage < readingLearning.totalPages) {
        // ★ 强制设置 isDirectReview=false，确保下一页不从 page-review 开始
        setIsDirectReview(false);
        setReviewMarks({});
        setReadingLearning(prev => prev ? { ...prev, pageIndex: nextPage } : null);
        setPageTransitionVisible(false);
      } else {
        goToReadingList();
      }
      return;
    }

    if (!selectedBook) return;

    // ★ 初次学完一页时标记为复习就绪（之后重新打开可进复习模式）
    incrementReviewRound(selectedBook.bookId, selectedBook.pageIndex);

    // 持久化：标记当前页完成 + 保存错词和历史
    markPageCompleted(selectedBook.bookId, selectedBook.pageIndex);
    if (state.errorWords.length > 0) {
      savePageErrorWords(selectedBook.bookId, selectedBook.pageIndex, state.errorWords.map(ew => ({
        word: ew.word,
        userInput: '',
        errorDetail: ew.detail,
      })));
    }
    savePageHistory(selectedBook.bookId, selectedBook.pageIndex, state.history);

    // 检查是否有下一页
    const nextBook = getBookById(selectedBook.bookId);
    if (nextBook && selectedBook.pageIndex + 1 < nextBook.totalPages) {
      const nextPage = selectedBook.pageIndex + 1;
      // ★ 强制设置 isDirectReview=false，确保下一页不从 page-review 开始
      setIsDirectReview(false);
      setReviewMarks({});
      setSelectedBook({ bookId: selectedBook.bookId, pageIndex: nextPage });
      setPageTransitionVisible(false);
    } else {
      goHome();
    }
  }, [selectedBook, state.errorWords, state.history, goHome]);

  const handleContinue = useCallback(() => {
    const jr = judgmentResult;
    if (!jr) return;
    setJudgmentResult(null);
    setJudgmentDone(false);

    // ★ 持久化 + A4纸标记：仅限复习阶段（第一次学习不显示任何点）
    const word = activeWordRef.current;
    const isReviewPhase = state.phase === 'group-review' || state.phase === 'prev-group-review' || state.phase === 'page-review';
    // 无论是否 selectedBook（阅读篇目模式下没有 selectedBook），复习阶段的标记都要显示
    if (word && isReviewPhase) {
      if (jr.correct) {
        // ★ 首次答错标红后，修正答对也不覆盖为绿色（标红就是最终标记）
        setReviewMarks(prev => {
          if (prev[word.id] === 'wrong') return prev;
          return { ...prev, [word.id]: 'correct' };
        });
        if (selectedBook) {
          markWordMastered(selectedBook.bookId, selectedBook.pageIndex, word);
        } else if (readingLearning) {
          markWordMastered(`reading_${readingLearning.articleId}`, readingLearning.pageIndex, word);
        }
      } else {
        setReviewMarks(prev => ({ ...prev, [word.id]: 'wrong' }));
        if (selectedBook) {
          markWordWrong(selectedBook.bookId, selectedBook.pageIndex, word);
        } else if (readingLearning) {
          markWordWrong(`reading_${readingLearning.articleId}`, readingLearning.pageIndex, word);
        }
      }
    }

    // 答错了：不前进，重新输入
    if (!jr.correct && (state.phase === 'recall' || state.phase === 'group-review' || state.phase === 'prev-group-review' || state.phase === 'page-review')) {
      setRecallKey(k => k + 1);
      return;
    }

    if (state.phase === 'group-review' && state.groupReviewQueue.length > 0) {
      completeGroupReviewItem();
    } else if (state.phase === 'group-review' && state.prevGroupReviewQueue.length > 0) {
      completePrevGroupReviewItem();
    } else if (state.phase === 'prev-group-review') {
      completePrevGroupReviewItem();
    } else if (state.phase === 'page-review') {
      // ★ 整页复习完成时增加一轮记录（首页绿点会+1）
      // 先调 completePageReviewItem，如果是最后一个词 phase 会变成 page-done
      const wasLastWord = state.pageReviewIndex + 1 >= state.pageReviewQueue.length;
      completePageReviewItem();
      if (wasLastWord) {
        if (selectedBook) {
          incrementReviewRound(selectedBook.bookId, selectedBook.pageIndex);
        } else if (readingLearning) {
          incrementReviewRound(`reading_${readingLearning.articleId}`, readingLearning.pageIndex);
        }
      }
    } else if (state.phase === 'recall') {
      completeRecall(jr.correct, jr.userInput, jr.detail);
    }
  }, [judgmentResult, state.phase, state.groupReviewQueue.length, state.prevGroupReviewQueue.length,
      completeGroupReviewItem, completePrevGroupReviewItem, completePageReviewItem, completeRecall,
      selectedBook, readingLearning]);

  const handleFinishLearning = useCallback(() => {
    finishLearning();
  }, [finishLearning]);

  const handleA4InputSubmit = useCallback((text: string): { success: boolean; error?: string } => {
    return confirmA4Input(text);
  }, [confirmA4Input]);

  const handleRecallSubmit = useCallback((correct: boolean, userInput: string, detail?: string) => {
    setJudgmentResult({ correct, userInput, detail });
    setJudgmentDone(false);

    // ★ 持久化单词掌握进度——仅在 handleContinue（答对/答错后）统一处理
    // 这里只设置结果状态
  }, []);

  const handleContinueAfterJudgment = useCallback(() => {
    setJudgmentDone(true);
    handleContinue();
  }, [handleContinue]);

  const handlePageDoneContinue = useCallback(() => {
    setPageTransitionVisible(true);
  }, []);

  // ★ 获取当前正在操作的单词（用于持久化），写入 ref 供 useCallback 获取
  const isRecalling = state.phase === 'recall';
  const isGroupReview = state.phase === 'group-review' && state.groupReviewQueue.length > 0;
  const isPrevGroupReview = state.phase === 'prev-group-review';
  const isPageReview = state.phase === 'page-review';

  const activeWord = isGroupReview
    ? state.groupReviewQueue[state.groupReviewIndex]
    : isPrevGroupReview
      ? state.prevGroupReviewQueue[state.prevGroupReviewIndex]
      : isPageReview
        ? state.pageReviewQueue[state.pageReviewIndex]
        : state.currentWord;
  activeWordRef.current = activeWord;

  // 正在从后端恢复数据
  if (restoring) {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666', fontSize: '16px' }}>
          正在恢复数据…
        </div>
      </div>
    );
  }

  // 首页
  if (view === 'home') {
    return (
      <div className="app-container">
        <div className="app-home-scroll">
          <HomePage
            onStartLearning={handleStartLearning}
            onCreateBook={handleCreateBook}
            onOpenReading={handleOpenReading}
            onOpenPhraseBook={handleOpenPhraseBook}
            onOpenSyncSettings={handleOpenSyncSettings}
            onOpenAbyss={handleOpenAbyss}
          />
        </div>
      </div>
    );
  }

  // 手动建词书页
  if (view === 'create-book') {
    return (
      <div className="app-container">
        <CreateBookPage onBack={goHome} />
      </div>
    );
  }

  // 阅读生词簿
  if (view === 'reading') {
    return (
      <div className="app-container">
        <ArticleListPage onBack={goHome} onStartLearning={handleStartReadingLearning} />
      </div>
    );
  }

  // 短语积累本
  if (view === 'phrasebook') {
    return (
      <div className="app-container">
        <PhraseBookPage onBack={goHome} />
      </div>
    );
  }

  // 同步设置
  if (view === 'sync-settings') {
    return (
      <SyncSettingsPage onBack={goHome} />
    );
  }

  // 🦐 异世界入口
  if (view === 'abyss') {
    return <AbyssPortal onExit={handleExitAbyss} />;
  }

  // ★ 阅读篇目学习 — 过渡页
  if (view === 'reading-learning' && pageTransitionVisible) {
    const completedPage = readingLearning?.pageIndex ?? 0;
    const isLastPage = (readingLearning?.pageIndex ?? 0) + 1 >= (readingLearning?.totalPages ?? 1);

    return (
      <div className="app-container">
        <div className="page-transition">
          <div className="transition-icon">✓</div>
          <div className="transition-main-text">
            {isLastPage ? '🎉 全篇完成！' : `第 ${completedPage + 1} 页完成！`}
          </div>
          <div className="transition-actions">
            {!isLastPage && (
              <button className="transition-btn primary" onClick={advanceToNextPage}>
                继续 → 下一页
              </button>
            )}
            <button className="transition-btn secondary" onClick={goToReadingList}>
              {isLastPage ? '返回阅读生词簿' : '返回阅读生词簿'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ★ 阅读篇目学习页
  if (view === 'reading-learning') {
    return (
      <div className="app-container">
        <div className="learning-navbar">
          <button className="nav-back-btn" onClick={goToReadingList} title="返回阅读生词簿">
            ← 返回
          </button>
          <span className="nav-title">
            {readingLearning?.title ?? ''}
            {(readingLearning?.totalPages ?? 1) > 1 && (
              <span className="nav-page-num">
                第 {(readingLearning?.pageIndex ?? 0) + 1}/{readingLearning?.totalPages ?? 1} 页
              </span>
            )}
          </span>
          <div className="nav-progress">
            {state.globalWordIndex} / {readingLearningWords.length}
          </div>
        </div>

        <div className="work-area-container">
          <WorkArea
            phase={state.phase}
            currentWord={state.currentWord}
            groupReviewQueue={state.groupReviewQueue}
            groupReviewIndex={state.groupReviewIndex}
            prevGroupReviewQueue={state.prevGroupReviewQueue}
            prevGroupReviewIndex={state.prevGroupReviewIndex}
            pageReviewQueue={state.pageReviewQueue}
            pageReviewIndex={state.pageReviewIndex}
            globalWordIndex={state.globalWordIndex}
            totalWords={readingLearningWords.length}
            judgmentResult={judgmentResult}
            isRecalling={isRecalling}
            isGroupReview={isGroupReview}
            isPrevGroupReview={isPrevGroupReview}
            isPageReview={isPageReview}
            judgmentDone={judgmentDone}
            recallKey={recallKey}
            onFinishLearning={handleFinishLearning}
            onRecallSubmit={handleRecallSubmit}
            onContinueAfterJudgment={handleContinueAfterJudgment}
            onPageDoneContinue={handlePageDoneContinue}
          />
        </div>

        <div className="app-divider" />

        <div className="a4-paper-container">
          <A4Paper
            words={state.a4Words}
            phase={state.phase}
            a4GroupIndex={state.currentGroup}
            a4SlotIndex={state.currentWordInGroup}
            a4WriteTarget={state.a4WriteTarget}
            onA4InputSubmit={handleA4InputSubmit}
            reviewMarks={reviewMarks}
          />
        </div>
      </div>
    );
  }

  // 页间过渡页
  if (view === 'learning' && pageTransitionVisible) {
    const completedPage = selectedBook?.pageIndex ?? 0;
    return (
      <div className="app-container">
        <div className="page-transition">
          <div className="transition-icon">✓</div>
          <div className="transition-main-text">第 {completedPage + 1} 页完成！</div>
          <div className="transition-actions">
            <button className="transition-btn primary" onClick={advanceToNextPage}>
              继续 → 下一页
            </button>
            <button className="transition-btn secondary" onClick={goHome}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 学习页
  return (
    <div className="app-container">
      {/* 顶部导航 */}
      <div className="learning-navbar">
        <button className="nav-back-btn" onClick={goHome} title="返回首页">
          ← 返回
        </button>
        <span className="nav-title">
          {selectedBook
            ? (getBookById(selectedBook.bookId)?.title ?? '')
            : ''}
          <span className="nav-page-num">
            第 {(selectedBook?.pageIndex ?? 0) + 1} 页
          </span>
        </span>
        <div className="nav-progress">
          {state.globalWordIndex} / {pageWords.length}
        </div>
      </div>

      <div className="work-area-container">
        <WorkArea
          phase={state.phase}
          currentWord={state.currentWord}
          groupReviewQueue={state.groupReviewQueue}
          groupReviewIndex={state.groupReviewIndex}
          prevGroupReviewQueue={state.prevGroupReviewQueue}
          prevGroupReviewIndex={state.prevGroupReviewIndex}
          pageReviewQueue={state.pageReviewQueue}
          pageReviewIndex={state.pageReviewIndex}
          globalWordIndex={state.globalWordIndex}
          totalWords={pageWords.length}
          judgmentResult={judgmentResult}
          isRecalling={isRecalling}
          isGroupReview={isGroupReview}
          isPrevGroupReview={isPrevGroupReview}
          isPageReview={isPageReview}
          judgmentDone={judgmentDone}
          recallKey={recallKey}
          onFinishLearning={handleFinishLearning}
          onRecallSubmit={handleRecallSubmit}
          onContinueAfterJudgment={handleContinueAfterJudgment}
          onPageDoneContinue={handlePageDoneContinue}
        />
      </div>

      <div className="app-divider" />

      <div className="a4-paper-container">
        <A4Paper
          words={state.a4Words}
          phase={state.phase}
          a4GroupIndex={state.currentGroup}
          a4SlotIndex={state.currentWordInGroup}
          a4WriteTarget={state.a4WriteTarget}
          onA4InputSubmit={handleA4InputSubmit}
          reviewMarks={reviewMarks}
        />
      </div>
    </div>
  );
}

export default function AppWithToast() {
  return (
    <>
      <App />
      <SaveStatusToast />
    </>
  );
}
