/**
 * 语义判断 — 优先本地关键词匹配秒判，低置信度时调AI验证
 */
import type { Word } from '../types';
import type { AIJudgment } from '../types';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

/* ================================================================
 *   本地关键词匹配（零API调用，毫秒级）
 * ================================================================ */

/**
 * 将中文文本切割成有意义的词块（保留重要概念词）
 */
function tokenize(text: string): Set<string> {
  const cleaned = text
    .replace(/[，。！？、；：""''（）【】《》\s,\.!?\?;:\(\)\[\]<>]/g, ' ')
    .toLowerCase();
  const tokens = cleaned.split(/\s+/).filter(t => t.length >= 2);
  return new Set(tokens);
}

/**
 * 提取释义中的关键词（去掉最通用的虚词）
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    '的', '了', '是', '在', '和', '与', '有', '为', '对', '被',
    '把', '让', '从', '到', '以', '之', '这', '那', '上', '下',
    '要', '会', '能', '可', '还', '也', '就', '都', '而', '且',
    '如果', '因为', '所以', '虽然', '但是', '以及', '或者', '并'
  ]);
  return text
    .replace(/[，。！？、；：""''（）【】《》\s,\.!?\?;:\(\)\[\]<>]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopWords.has(t));
}

/**
 * 计算两个字符串间的字重叠率
 */
function charOverlap(a: string, b: string): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection++;
  }
  return intersection / Math.min(setA.size, setB.size);
}

/**
 * 检查用户输入是否包含释义中的核心词汇
 */
function hasCoreKeywords(userInput: string, definition: string, coreConcept: string): boolean {
  const defKeywords = extractKeywords(definition);
  const conceptKeywords = extractKeywords(coreConcept);
  const allKeywords = [...defKeywords, ...conceptKeywords];

  // 选最重要的3-5个关键词（按长度排序，长词更关键）
  const importantWords = [...new Set(allKeywords)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);

  if (importantWords.length === 0) return false;

  const inputSet = tokenize(userInput);
  let matchCount = 0;
  for (const kw of importantWords) {
    // 检查用户输入是否包含这个关键词或其子串匹配
    if ([...inputSet].some(t => t.includes(kw) || kw.includes(t))) {
      matchCount++;
    }
    // 也检查用户输入的原文中是否有该关键词
    if (userInput.includes(kw) || kw.includes(userInput.replace(/\s/g, ''))) {
      matchCount++;
    }
  }

  return matchCount >= Math.min(2, importantWords.length);
}

/**
 * 检查是否明显不认识
 */
function isUnfamiliar(input: string): boolean {
  const keywords = ['不知道', '不认识', '不会', '忘了', '想不起来', '不记得', '没学过', '忘记了'];
  return keywords.some(k => input.includes(k));
}

/**
 * 检查是否像同义词辨析混淆
 */
function detectConfusion(word: Word, _userInput: string): { isConfused: boolean; confusedWord?: string } {
  // 简单启发式：用户回答包含其他常见IELTS单词的释义
  const commonConfusions: Record<string, string[]> = {
    'economic': ['economical', 'financial', 'economy'],
    'economical': ['economic', 'financial', 'economy'],
    'affect': ['effect'],
    'effect': ['affect'],
    'complement': ['compliment'],
    'principal': ['principle'],
    'stationary': ['stationery'],
    'adapt': ['adopt', 'adept'],
    'adopt': ['adapt', 'adept'],
    'ensure': ['insure', 'assure'],
    'insure': ['ensure', 'assure'],
  };

  const lowerWord = word.word.toLowerCase();
  const confusedBy = commonConfusions[lowerWord];
  if (!confusedBy) return { isConfused: false };

  // 检查用户是否在说疑似混淆词的释义
  return { isConfused: true, confusedWord: confusedBy[0] };
}

/**
 * 本地快速判断（纯逻辑，无需API）
 */
function localJudge(word: Word, userInput: string): AIJudgment | null {
  // 1. 空输入或不认识
  if (!userInput.trim() || userInput.trim().length < 2) {
    return {
      correct: false,
      confidence: 0.95,
      errorType: 'unfamiliar',
      errorDetail: '没有输入内容',
    };
  }

  if (isUnfamiliar(userInput)) {
    return {
      correct: false,
      confidence: 0.95,
      errorType: 'unfamiliar',
      errorDetail: '学生表示不认识该单词',
    };
  }

  // 2. 核心关键词匹配 — 包含释义关键词，大概率对了
  const keywordsMatch = hasCoreKeywords(userInput, word.definition, word.coreConcept);
  
  // 3. 字重叠率分析
  const overlapDef = charOverlap(userInput, word.definition + word.coreConcept);
  const overlapThreshold = 0.3; // 30%以上字重叠认为语义相关

  // 4. 判断结果 — 放宽条件，更多情况本地秒判
  if (keywordsMatch && overlapDef >= overlapThreshold) {
    // 关键词匹配 + 字重叠高 → 肯定对了
    return {
      correct: true,
      confidence: 0.85,
      errorType: undefined,
      correctAnswer: word.coreConcept,
    };
  }

  if (keywordsMatch && userInput.length >= 4) {
    // 有核心关键词 → 基本对了，本地判正确
    return {
      correct: true,
      confidence: 0.70,
      errorType: undefined,
      correctAnswer: word.coreConcept,
    };
  }

  // 5. 明显理解错误
  if (userInput.length >= 4) {
    const confusionCheck = detectConfusion(word, userInput);
    if (confusionCheck.isConfused) {
      return {
        correct: false,
        confidence: 0.7,
        errorType: 'confusion',
        confusedWord: confusionCheck.confusedWord,
        errorDetail: `可能与单词 "${confusionCheck.confusedWord}" 混淆了`,
      };
    }
  }

  // 6. 完全没提到关键概念 → 错误
  if (!keywordsMatch && overlapDef < 0.15 && userInput.length >= 4) {
    return {
      correct: false,
      confidence: 0.7,
      errorType: 'misunderstanding',
      errorDetail: `输入与"${word.word}"的含义有明显差距，正确释义是"${word.definition}"`,
      correctAnswer: word.coreConcept,
    };
  }

  // 边缘情况 → 需要AI
  return null;
}


/* ================================================================
 *   DeepSeek API 调用（仅在本地判断不确定时使用）
 * ================================================================ */

function buildAIPrompt(word: Word, userInput: string): string {
  return `你是一个严格的IELTS词汇判官。任务：判断学生是否理解单词 "${word.word}" 的语义。

⚠️ 重要约束：
- 你只可以分析和判断单词 **"${word.word}"**，绝对不要提及或假设任何其他单词。
- 你的回答中不要出现除了 "${word.word}" 以外的任何英文单词（除非在errorDetail中引用）。
- 如果学生回答错误，用errorDetail解释哪里不对，并以 "${word.definition}" 作为正确答案。

当前单词：
- 单词：${word.word}
- 词性：${word.pos}
- 正确释义：${word.definition}
- 核心概念：${word.coreConcept}

学生输入：${userInput}

输出JSON（不要返回其他内容）：
{"correct":bool,"confidence":0~1,"errorType":"unfamiliar|misunderstanding|confusion|polysemy|null","confusedWord":"","correctAnswer":"${word.definition}","errorDetail":"简短的中文解释"}`;
}

async function callDeepSeek(apiKey: string, word: Word, userInput: string): Promise<AIJudgment> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildAIPrompt(word, userInput) }
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('API Key无效');
      throw new Error(`API错误 ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();

    return JSON.parse(json);
  } catch (e: any) {
    // AI失败时回到本地判断，放宽标准
    const localResult = localJudge(word, userInput);
    if (localResult) return localResult;
    // 兜底：假设错误
    return {
      correct: false,
      confidence: 0.5,
      errorType: 'misunderstanding',
      errorDetail: '需要AI验证，但API调用失败',
      correctAnswer: word.coreConcept,
    };
  } finally {
    clearTimeout(timeout);
  }
}


/* ================================================================
 *   主入口：先本地秒判 → 不确定才调AI
 * ================================================================ */

export async function judgeWordMeaning(config: { apiKey: string; word: Word; userInput: string }): Promise<AIJudgment> {
  const { word, userInput } = config;

  // 第一步：本地关键词匹配（0ms~1ms）
  const localResult = localJudge(word, userInput);
  if (localResult) {
    return localResult;
  }

  // 第二步：本地不确定，调AI（可能需要3-8秒）
  if (config.apiKey) {
    return callDeepSeek(config.apiKey, word, userInput);
  }

  // 没有API Key时的最终兜底
  return {
    correct: false,
    confidence: 0.5,
    errorType: 'misunderstanding',
    errorDetail: 'AI判断服务不可用，请设置API Key',
    correctAnswer: word.coreConcept,
  };
}
