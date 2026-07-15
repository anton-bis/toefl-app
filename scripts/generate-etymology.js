/**
 * 词源数据生成脚本
 * 使用 LLM（GPT-4o-mini）批量生成词汇的音标、释义、词源拆解
 *
 * 用法:
 *   set OPENAI_API_KEY=sk-xxx
 *   node scripts/generate-etymology.js [--subject=reading] [--dry-run]
 *   node scripts/generate-etymology.js --all [--dry-run]
 *
 * --dry-run: 只估算费用，不实际调用 API
 * --subject: 只处理指定科目
 * --all: 处理所有科目
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VOCAB_DIR = path.resolve(ROOT, 'assets/questions/vocabulary');

const API_KEY = process.env.OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const BATCH_SIZE = 10;  // 每批 10 个词
const COST_PER_INPUT_TOKEN = 0.00000015;   // $0.15/M tokens
const COST_PER_OUTPUT_TOKEN = 0.0000006;   // $0.60/M tokens

function log(msg) { console.log(`[etymology] ${msg}`); }

async function callLLM(prompt) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a precise etymology and linguistics expert. Output ONLY valid JSON, no other text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Try to extract JSON from the response
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
  return JSON.parse(jsonStr.trim());
}

function buildPrompt(words) {
  const wordList = words.map((w, i) =>
    `${i + 1}. word="${w.word}", subject="${w.subject}", example="${(w.example || '').replace(/"/g, '\\"')}"`
  ).join('\n');

  return `You are a TOEFL vocabulary expert. Generate precise linguistic data for each word below.

For each word, output a JSON array entry with EXACTLY this structure:
{
  "word": "the word",
  "pronunciation": { "us": "US IPA (e.g. /əˈbʌndənt/)", "uk": "UK IPA (e.g. /əˈbʌndənt/)" },
  "pos": [{ "type": "adj|adv|n|v|prep|conj|pron|interj", "translation": "Chinese meaning" }],
  "inflections": {
    "comparative": "comparative form or empty string",
    "superlative": "superlative form or empty string",
    "adverb": "adverb form or empty string",
    "noun": "noun form or empty string"
  },
  "etymology": {
    "prefix": { "form": "prefix if exists", "meaning": "meaning of prefix" } || null,
    "root": { "form": "root if exists", "meaning": "meaning of root" } || null,
    "suffix": { "form": "suffix if exists", "meaning": "meaning of suffix" } || null,
    "summary": "brief Chinese explanation of word formation (e.g. 'pre-(before) + dict-(say) → predict')"
  }
}

Rules:
1. pronunciation: Use standard IPA. Always provide both US and UK.
2. pos: List 1-3 common meanings. Include part of speech abbreviation.
3. inflections: Fill in known forms. Leave as empty string if not applicable.
4. etymology: Be thorough but honest. If a part doesn't exist (e.g. no prefix), use null.
   The summary should be in Chinese, explaining how prefix+root+suffix combine to form the meaning.
5. If you're unsure about etymology, provide your best analysis based on Latin/Greek roots.

Words:
${wordList}

Output ONLY a valid JSON array, no other text.`;
}

async function processSubject(subject, dryRun) {
  const filePath = path.join(VOCAB_DIR, `${subject}-words.json`);
  if (!fs.existsSync(filePath)) {
    log(`跳过 ${subject}: 文件不存在`);
    return { total: 0, cost: 0 };
  }

  let words = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  // Only process words without etymology data
  const toProcess = words.filter(w => !w.etymology || !w.etymology.summary);
  const alreadyDone = words.length - toProcess.length;

  log(`${subject}: ${words.length} 词, 已完成 ${alreadyDone}, 待处理 ${toProcess.length}`);

  if (toProcess.length === 0) {
    return { total: 0, cost: 0 };
  }

  if (dryRun) {
    // Estimate cost
    const samplePrompt = buildPrompt(toProcess.slice(0, BATCH_SIZE));
    const estimatedInputTokens = samplePrompt.length / 4 * Math.ceil(toProcess.length / BATCH_SIZE);
    const estimatedOutputTokens = 200 * Math.ceil(toProcess.length / BATCH_SIZE);
    const cost = estimatedInputTokens * COST_PER_INPUT_TOKEN + estimatedOutputTokens * COST_PER_OUTPUT_TOKEN;
    log(`  Dry-run: ~${estimatedInputTokens} input tokens, ~${estimatedOutputTokens} output tokens`);
    log(`  Estimated cost: $${cost.toFixed(4)}`);
    return { total: toProcess.length, cost };
  }

  // Process in batches
  let updated = 0;
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchWords = batch.map(w => words.findIndex(e => e.id === w.id));

    log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toProcess.length / BATCH_SIZE)} (${batch.length} words)...`);

    try {
      const prompt = buildPrompt(batch);
      const results = await callLLM(prompt);

      for (const result of results) {
        const idx = words.findIndex(w => w.word === result.word);
        if (idx === -1) {
          log(`  WARNING: Word "${result.word}" not found in ${subject} list, skipping`);
          continue;
        }
        words[idx].pronunciation = result.pronunciation;
        words[idx].pos = result.pos;
        words[idx].inflections = result.inflections;
        words[idx].etymology = result.etymology;
        updated++;
      }

      // Write after each batch to avoid losing progress
      fs.writeFileSync(filePath, JSON.stringify(words, null, 2), 'utf-8');
      log(`    → 已保存 ${updated}/${toProcess.length} 词`);

      // Rate limiting delay
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      log(`  ERROR in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);
      log(`  Will retry remaining words...`);
      // Continue with next batch
    }
  }

  log(`${subject}: 完成 ${updated}/${toProcess.length} 词`);
  return { total: toProcess.length, cost: 0 };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  const subjectArg = args.find(a => a.startsWith('--subject='));
  const targetSubject = subjectArg ? subjectArg.split('=')[1] : null;

  if (!API_KEY) {
    console.error('请设置 OPENAI_API_KEY 环境变量');
    console.error('  Windows: set OPENAI_API_KEY=sk-xxx');
    console.error('  PowerShell: $env:OPENAI_API_KEY="sk-xxx"');
    process.exit(1);
  }

  const subjects = targetSubject ? [targetSubject] :
    (all ? ['reading', 'listening', 'writing', 'speaking'] : []);

  if (subjects.length === 0) {
    console.error('请指定 --subject=reading 或 --all');
    process.exit(1);
  }

  log(`模式: ${dryRun ? 'DRY-RUN (估算费用)' : '实际执行'}`);
  log(`模型: ${MODEL}`);
  log(`科目: ${subjects.join(', ')}`);
  log(`每批: ${BATCH_SIZE} 词\n`);

  let grandTotal = 0;
  let grandCost = 0;

  for (const subject of subjects) {
    const result = await processSubject(subject, dryRun);
    grandTotal += result.total;
    grandCost += result.cost;
  }

  log('\n===== 完成 =====');
  log(`总计处理: ${grandTotal} 词`);
  if (dryRun) {
    log(`估算费用: $${grandCost.toFixed(4)} (约 ¥${(grandCost * 7.2).toFixed(2)})`);
  } else {
    log('词源数据已写入各科目词库 JSON');
  }
}

main().catch(err => {
  console.error('[generate-etymology] FATAL:', err);
  process.exit(1);
});
