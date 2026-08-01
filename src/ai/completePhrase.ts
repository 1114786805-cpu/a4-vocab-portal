/**
 * AI 短语补全 — 调 DeepSeek 对用户手动输入的短语自动补全释义/例句/备注
 *
 * 输入：短语文本 (可选已有释义)
 * 输出：释义 + 例句 + 备注
 */

const AI_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface PhraseCompleteResult {
  phrase: string;
  definition: string;
  example: string;
  notes: string;
}

function getApiKey(): string {
  try {
    return localStorage.getItem('wordsense_api_key') || '';
  } catch {
    return '';
  }
}

/**
 * 补全单个短语
 * @param phrase 短语（必填）
 * @param existingDef 用户已输入的释义（可选，AI 会参考/润色）
 */
export async function completePhrase(
  phrase: string,
  existingDef?: string,
): Promise<PhraseCompleteResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API Key 未设置，请先在设置中配置 DeepSeek API Key');
  }

  const defGuidance = existingDef?.trim()
    ? `用户已提供释义：${existingDef.trim()}\n请参考该释义，可以补充完善但不要偏离原意。`
    : '';

  const prompt = `你是英语短语教学专家。请为英语短语/习语 "${phrase}" 生成以下内容：

1. **中文释义**：精确的中文解释，说明短语的实际含义（不是字面意思）
2. **地道例句**：1个自然的地道英语例句，展示该短语的真实用法${phrase.includes(' ') ? '' : '（单词不是短语，请视为生词处理）'}
3. **实用备注**：该短语的使用场景、语气、注意事项或记忆技巧（一句话）

${defGuidance}

请严格按 JSON 格式回复，不要包含其他内容：
{
  "phrase": "${phrase}",
  "definition": "中文释义",
  "example": "英文例句 — 中文翻译",
  "notes": "实用备注一句话"
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
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 错误 (${response.status}): ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 响应格式异常，无法解析');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      phrase: parsed.phrase || phrase,
      definition: parsed.definition || '',
      example: parsed.example || '',
      notes: parsed.notes || '',
    };
  } catch (e) {
    throw new Error(`解析 JSON 失败: ${e}`);
  }
}
