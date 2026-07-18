const META_LINE = /^(To|From|Date|Subject|Title|Subtitle|username)[：:]\s*(.*)$/i;

export function instructionFor(type) {
  return (
    {
      email: 'Read an email',
      'text-chain': 'Read a text chain',
      notice: 'Read a notice',
      advertisement: 'Read an advertisement',
      'social-media': 'Read a social media post',
      'academic-passage': 'Read an academic passage'
    }[type] || 'Read the passage'
  );
}

export function parseDailyPassage(passage, type) {
  const lines = String(passage || '')
    .split(/\n/)
    .map(line => line.trim());
  const meta = {};
  const content = [];
  for (const line of lines) {
    const match = line.match(META_LINE);
    if (match) meta[match[1].toLowerCase()] = match[2].trim();
    else if (line) content.push(line);
  }

  if (type === 'email') {
    const greetingIndex = content.findIndex(line => /^(Dear|Hello|Hi)\b/i.test(line));
    const signoffIndex = content.findIndex(line =>
      /^(Regards|Sincerely|Best|Warm regards)/i.test(line)
    );
    return {
      ...meta,
      body: content
        .slice(Math.max(0, greetingIndex), signoffIndex < 0 ? content.length : signoffIndex)
        .join('\n\n'),
      signature: signoffIndex < 0 ? '' : content.slice(signoffIndex).join('\n')
    };
  }
  return { ...meta, body: content.join('\n\n') };
}

export function parseTextChain(passage) {
  const lines = String(passage || '')
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const messages = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*(.*)$/);
    if (match)
      messages.push({ sender: match[1].trim(), time: match[2].trim(), text: match[3].trim() });
    else if (messages.length) messages.at(-1).text += `${messages.at(-1).text ? ' ' : ''}${line}`;
  }
  return messages.length ? messages : [{ sender: '', time: '', text: String(passage || '') }];
}

export function fillTokens(passage, questions) {
  const tokens = [];
  let lastIndex = 0;
  let blankIndex = 0;
  const regex = /([a-zA-Z]+)((?:\\?_)+)/g;
  for (const match of String(passage || '').matchAll(regex)) {
    if (match.index > lastIndex)
      tokens.push({ type: 'text', text: passage.slice(lastIndex, match.index) });
    const question = questions[blankIndex++];
    const prefix = match[1];
    const fullAnswer = question?.answer || '';
    tokens.push({
      type: 'blank',
      prefix,
      question,
      length: Math.max(1, fullAnswer.length - prefix.length, match[2].replaceAll('\\', '').length)
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < String(passage || '').length)
    tokens.push({ type: 'text', text: passage.slice(lastIndex) });
  return tokens;
}

export function academicMode(question) {
  const prompt = String(question?.prompt || '');
  if (/Click on the sentence in paragraph/i.test(prompt)) return 'point-sentence';
  if (
    /Insert (?:the|this) sentence/i.test(prompt) ||
    /Where would the sentence best fit/i.test(prompt)
  )
    return 'insert-sentence';
  return 'choice';
}

export function paragraphSentences(passage, prompt) {
  const paragraphNumber = Number(String(prompt).match(/paragraph\s+(\d+)/i)?.[1] || 1);
  const paragraph =
    String(passage || '')
      .split(/\n\s*\n/)
      .filter(Boolean)[paragraphNumber - 1] || '';
  return (
    paragraph
      .match(/[^.!?]+[.!?]+(?:["'”’])?|[^.!?]+$/g)
      ?.map(value => value.trim())
      .filter(Boolean) || []
  );
}

export function insertionSentence(prompt) {
  return (
    String(prompt || '')
      .match(
        /(?:following sentence could be added|Insert this sentence):?\s*(?:["“]([^"”]+)["”]|([^\n]+))/i
      )
      ?.slice(1)
      .find(Boolean)
      ?.trim() || ''
  );
}
