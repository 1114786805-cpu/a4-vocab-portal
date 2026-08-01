/**
 * AI 单词补全 — 调 DeepSeek 对用户手动输入的单词自动生成完整教学内容
 *
 * 生成内容：
 * - 音标 (phonetic)
 * - 词性 (pos)
 * - 中文释义 (definition)
 * - 核心概念 (coreConcept)
 * - 例句 (examples, 2个)
 * - 常见搭配 (collocations, 2-3个)
 */

const AI_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface CompletedWord {
  word: string;
  phonetic: string;
  pos: string;
  definition: string;
  coreConcept: string;
  examples: string[];
  collocations: string[];
}

export interface WordCompleteResult {
  word: string;
  success: boolean;
  data?: CompletedWord;
  error?: string;
}

export function getApiKey(): string {
  try {
    return localStorage.getItem('wordsense_api_key') || '';
  } catch {
    return '';
  }
}

/**
 * 补全单个单词的完整教学信息
 */
async function completeSingleWord(word: string, apiKey: string): Promise<WordCompleteResult> {
  const prompt = `你是英语单词教学专家。请为单词 "${word}" 生成完整的单词教学卡片内容。

要求：
1. **音标**: 英式音标，用 // 包裹
2. **词性**: 如 v., n., adj., adv., prep. 等，必要时用 / 表示多词性
3. **中文释义**: 核心释义，1-2个关键义项
4. **核心概念**: 用4-8个字概括这个词最本质的用法/场景
5. **例句**: 2个地道英语例句，带中文翻译，用 JSON 数组
6. **搭配**: 2-3个常见搭配用法

请严格按 JSON 格式回复，不要包含其他内容：
{
  "word": "${word}",
  "phonetic": "/.../",
  "pos": "v.",
  "definition": "中文释义",
  "coreConcept": "核心概念几个字",
  "examples": ["例1", "例2"],
  "collocations": ["搭配1", "搭配2"]
}`;

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return {
      word,
      success: false,
      error: `API 错误 (${response.status}): ${errText.slice(0, 100)}`,
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { word, success: false, error: 'AI 响应格式异常，无法解析' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const cw: CompletedWord = {
      word: parsed.word || word,
      phonetic: parsed.phonetic || '',
      pos: parsed.pos || '',
      definition: parsed.definition || '',
      coreConcept: parsed.coreConcept || '',
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      collocations: Array.isArray(parsed.collocations) ? parsed.collocations : [],
    };
    return { word, success: true, data: cw };
  } catch (e) {
    return { word, success: false, error: `解析 JSON 失败: ${e}` };
  }
}

/**
 * 补全多个单词
 * 每批 5 个并发（防止 API 限流），逐个回调进度
 */
export async function completeWords(
  wordList: string[],
  apiKey: string,
  onProgress?: (done: number, total: number, current: WordCompleteResult) => void,
): Promise<WordCompleteResult[]> {
  const results: WordCompleteResult[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < wordList.length; i += CONCURRENCY) {
    const batch = wordList.slice(i, i + CONCURRENCY);
    const batchPromises = batch.map(w => completeSingleWord(w, apiKey));
    const batchResults = await Promise.all(batchPromises);

    for (const r of batchResults) {
      results.push(r);
      onProgress?.(results.length, wordList.length, r);
    }
  }

  return results;
}

/**
 * 将 CompleteWords 的结果转换为 Word 类型（兼容 types/index.ts 的 Word）
 */
export function completedWordsToWords(results: WordCompleteResult[]): import('../types').Word[] {
  const words: import('../types').Word[] = [];
  for (const r of results) {
    if (!r.success || !r.data) continue;
    const d = r.data;
    words.push({
      id: d.word.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      word: d.word,
      pos: d.pos,
      definition: d.definition,
      coreConcept: d.coreConcept,
      examples: d.examples,
      collocations: d.collocations,
      phonetic: d.phonetic,
    });
  }
  return words;
}
