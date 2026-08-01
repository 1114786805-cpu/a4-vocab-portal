/**
 * AI 单词审核 — 调 DeepSeek 对 OCR 候选词做质量把关
 *
 * 功能：
 * 1. 过滤噪音（OCR 残废词、乱码）
 * 2. 纠正拼写错误（如 "accomplishcd" → "accomplished"）
 * 3. 去除非单词（数字、符号残留等）
 *
 * 预过滤功能：
 * - 自动过滤初中级别以下简单词（a, the, and, is 这类）
 * - 自动过滤2字母短词（大多是OCR错误提取）
 */

const AI_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface AIReviewResult {
  word: string;
  status: 'valid' | 'corrected' | 'noise';
  correctedWord?: string;
  reason?: string;
}

/**
 * 初中级别简单英语词汇表
 * 这些词如果被 OCR 提取出来，直接过滤掉，不需要 AI 审核
 */
const EASY_WORDS = new Set([
  // 冠词/代词
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'it', 'its',
  'i', 'my', 'me', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'what', 'who', 'whom', 'which',
  'some', 'any', 'no', 'none', 'all', 'each', 'every', 'both', 'few',
  'many', 'much', 'more', 'most', 'several', 'other', 'another',
  // 常见介词
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with', 'from', 'into',
  'about', 'above', 'across', 'after', 'against', 'along', 'among',
  'around', 'before', 'behind', 'below', 'beneath', 'beside', 'between',
  'beyond', 'but', 'down', 'during', 'except', 'inside', 'near',
  'off', 'onto', 'outside', 'over', 'past', 'since', 'through',
  'throughout', 'toward', 'under', 'underneath', 'until', 'up', 'upon',
  'within', 'without',
  // 常见连词
  'and', 'or', 'nor', 'so', 'yet', 'if', 'then', 'than', 'as', 'when',
  'while', 'where', 'because', 'although', 'though', 'unless',
  'whether', 'since', 'once', 'until', 'after', 'before',
  // 常见 be 动词/助动词
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'have', 'has', 'had', 'having',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might',
  'must', 'need', 'dare', 'ought',
  // 常见基础动词
  'go', 'went', 'gone', 'going', 'goes',
  'come', 'came', 'comes', 'coming',
  'make', 'made', 'makes', 'making',
  'take', 'took', 'takes', 'taking', 'taken',
  'get', 'got', 'gets', 'getting', 'gotten',
  'give', 'gave', 'gives', 'giving', 'given',
  'use', 'used', 'uses', 'using',
  'say', 'said', 'says', 'saying',
  'see', 'saw', 'seen', 'sees', 'seeing',
  'know', 'knew', 'knows', 'knowing',
  'think', 'thought', 'thinks', 'thinking',
  'want', 'wanted', 'wants', 'wanting',
  'like', 'liked', 'likes', 'liking',
  'look', 'looked', 'looks', 'looking',
  'find', 'found', 'finds', 'finding',
  'tell', 'told', 'tells', 'telling',
  'ask', 'asked', 'asks', 'asking',
  'work', 'worked', 'works', 'working',
  'call', 'called', 'calls', 'calling',
  'put', 'puts', 'putting',
  'set', 'sets', 'setting',
  'let', 'lets', 'letting',
  'show', 'showed', 'shows', 'showing', 'shown',
  'try', 'tried', 'tries', 'trying',
  'keep', 'kept', 'keeps', 'keeping',
  'bring', 'brought', 'brings', 'bringing',
  // 常见基础形容词/副词
  'good', 'well', 'bad', 'badly', 'big', 'small', 'new', 'old',
  'high', 'low', 'long', 'short', 'tall', 'wide', 'narrow',
  'hot', 'cold', 'warm', 'cool', 'hard', 'soft', 'fast', 'slow',
  'right', 'wrong', 'true', 'false', 'real', 'sure',
  'great', 'large', 'little', 'much', 'many', 'enough',
  'full', 'empty', 'open', 'closed', 'early', 'late',
  'first', 'last', 'next', 'same', 'different',
  'important', 'possible', 'necessary',
  'here', 'there', 'now', 'then', 'again', 'always', 'never',
  'often', 'sometimes', 'usually', 'already', 'still', 'just',
  'very', 'too', 'also', 'only', 'really', 'quite', 'almost',
  'even', 'ever', 'maybe', 'perhaps', 'quite',
  // 常见基础名词
  'time', 'year', 'day', 'week', 'month', 'hour', 'minute', 'second',
  'people', 'person', 'man', 'woman', 'child', 'boy', 'girl',
  'thing', 'way', 'part', 'place', 'world', 'home', 'house', 'room',
  'door', 'window', 'table', 'chair', 'bed', 'car', 'road', 'street',
  'city', 'town', 'country', 'state', 'school', 'college', 'university',
  'book', 'word', 'name', 'number', 'line', 'page', 'letter',
  'hand', 'head', 'face', 'eye', 'ear', 'nose', 'mouth', 'arm', 'leg',
  'foot', 'body', 'hair', 'skin',
  'life', 'death', 'love', 'hate', 'joy', 'fear', 'hope',
  'water', 'food', 'air', 'sun', 'moon', 'star', 'earth', 'fire',
  'money', 'price', 'cost', 'question', 'answer', 'idea', 'fact',
  'problem', 'reason', 'result', 'example', 'case', 'group',
  'number', 'family', 'father', 'mother', 'brother', 'sister',
  'friend', 'teacher', 'student', 'doctor', 'worker',
  'color', 'red', 'blue', 'green', 'white', 'black', 'dark', 'light',
  'morning', 'afternoon', 'evening', 'night', 'today', 'tomorrow',
  'yesterday', 'north', 'south', 'east', 'west',
  'side', 'end', 'top', 'bottom', 'front', 'back', 'middle', 'center',
  // 数词
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'hundred', 'thousand', 'million',
]);

/**
 * 预过滤简单词和2字母短词
 * 返回 { filtered: string[], easyRemoved: string[], shortRemoved: string[] }
 */
export function filterEasyWords(words: string[]): {
  filtered: string[];
  easyRemoved: string[];
  shortRemoved: string[];
} {
  const easyRemoved: string[] = [];
  const shortRemoved: string[] = [];
  const filtered: string[] = [];

  for (const w of words) {
    const lower = w.toLowerCase().trim();

    // 2字母及以下的短词 —— 大多数是OCR错误提取
    if (lower.length <= 2) {
      shortRemoved.push(w);
      continue;
    }

    // 初中简单词
    if (EASY_WORDS.has(lower)) {
      easyRemoved.push(w);
      continue;
    }

    filtered.push(w);
  }

  return { filtered, easyRemoved, shortRemoved };
}

/**
 * 从 localStorage 读取 DeepSeek API key
 * （与 WordSense 共享存储）
 */
export function getApiKey(): string {
  try {
    return localStorage.getItem('wordsense_api_key') || '';
  } catch {
    return '';
  }
}

/**
 * 调用 DeepSeek 审核一批单词
 */
export async function reviewWordsAI(
  words: string[],
  apiKey: string,
  onProgress?: (done: number, total: number) => void,
): Promise<AIReviewResult[]> {
  if (!apiKey) throw new Error('未配置 API Key，请先在设置中填写 DeepSeek API Key');
  if (words.length === 0) return [];

  // 每批最多 50 个词（防止 token 太长）
  const BATCH_SIZE = 50;
  const allResults: AIReviewResult[] = [];
  let doneCount = 0;

  // 第一步：本地预过滤简单词和短词
  const { filtered, easyRemoved, shortRemoved } = filterEasyWords(words);
  const removedCount = easyRemoved.length + shortRemoved.length;

  // 将预过滤掉的词标记为 noise，保留统计
  for (const w of easyRemoved) {
    allResults.push({
      word: w,
      status: 'noise',
      reason: '初中级简单词，自动过滤',
    });
  }
  for (const w of shortRemoved) {
    allResults.push({
      word: w,
      status: 'noise',
      reason: w.length === 1 ? '单字母，自动过滤' : '2字母短词，自动过滤',
    });
  }

  doneCount += removedCount;
  onProgress?.(doneCount, words.length);

  // 如果没有需要 AI 审核的词了，直接返回
  if (filtered.length === 0) {
    return allResults;
  }

  // AI 审核只送过滤后的词（节省 token 和 API 调用）
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);
    const results = await reviewBatch(batch, apiKey);
    allResults.push(...results);
    doneCount += batch.length;
    onProgress?.(doneCount, words.length);
  }

  return allResults;
}

async function reviewBatch(words: string[], apiKey: string): Promise<AIReviewResult[]> {
  const prompt = `你是英语单词拼写审核专家。以下是 OCR 从扫描件中提取出的候选单词列表，很多可能有误。

请对每个单词做三件事：
1. **过滤噪音** — 如果该词明显是 OCR 误识别（如 "fl；"、"thc"、"1he" 等乱码，或包含数字/符号的伪单词），标记为 "noise"
2. **纠正拼写** — 如果是常见拼写错误（如 "accomplishcd" → "accomplished"、"recieve" → "receive"），标记为 "corrected" 并给出正确拼写
3. **确认有效** — 如果是真实存在的英语单词（包括专有名词、技术术语、缩写），标记为 "valid"

单词列表:
${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}

请严格按 JSON 格式回复，不要包含其他内容：
{
  "results": [
    { "word": "原词", "status": "valid|corrected|noise", "correctedWord": "仅当status=corrected时填写", "reason": "简短理由" }
  ]
}`;

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,  // 低温度提高确定性
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API 错误 (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 尝试从回复中提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 响应格式异常，无法解析');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.results || [];
  } catch (e) {
    throw new Error(`解析 AI 响应 JSON 失败: ${e}`);
  }
}
