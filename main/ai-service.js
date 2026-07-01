async function chat(config, userMessage, history = []) {
  let url = config.url.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  // 格式判断：/anthropic 或 /messages → Anthropic 格式，/chat/completions → OpenAI 格式
  const isAnthropic = url.includes('/anthropic') || url.includes('/messages');

  let body, headers;

  if (isAnthropic) {
    headers = {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    };
    body = {
      model: config.model || 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: config.systemPrompt,
      messages: [...history, { role: 'user', content: userMessage }]
    };
  } else {
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    };
    const messages = [
      { role: 'system', content: config.systemPrompt },
      ...history
    ];
    if (userMessage) messages.push({ role: 'user', content: userMessage });
    body = {
      model: config.model || 'gpt-4o-mini',
      max_tokens: 500,
      messages
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('请求超时(15秒)');
    throw new Error(`无法连接 ${url} —— ${e.message}`);
  }
  clearTimeout(timer);

  const text = await res.text();

  if (!res.ok) {
    // 如果是 Anthropic 格式失败，尝试提示用户
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`接口返回了非JSON内容，请检查URL。当前: ${url}`);
  }

  // Anthropic 格式: content 数组中可能有 thinking 块，需找 type="text" 的
  if (data.content && Array.isArray(data.content)) {
    const textBlock = data.content.find(b => b.type === 'text' && b.text);
    if (textBlock) return { reply: textBlock.text.trim() };
  }
  // OpenAI 格式
  if (data.choices?.[0]?.message?.content != null) {
    return { reply: data.choices[0].message.content.trim() };
  }

  console.error('[ai-service] 未知响应格式:', JSON.stringify(data).slice(0, 500));
  throw new Error(`未知响应格式，请检查接口是否兼容。响应: ${text.slice(0, 150)}`);
}

module.exports = { chat };
