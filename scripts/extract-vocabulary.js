/**
 * TPO vocabulary extraction script.
 * Extracts B1+ vocabulary from TPO Markdown and groups it by section.
 *
 * Usage: node scripts/extract-vocabulary.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TPO_DIR = path.resolve(ROOT, 'assets/questions');
const OUTPUT_DIR = path.resolve(ROOT, 'assets/questions/vocabulary');
const CEFR_PATH = path.resolve(ROOT, 'assets/cefr-a1-a2.json');
const SET_SIZE = 25;
const MIN_FREQ = 1;

// ── Load CEFR exclusion list ──
const cefrSet = new Set(JSON.parse(fs.readFileSync(CEFR_PATH, 'utf-8')));

// ── Utils ──
function log(msg) {
  console.log(`[vocab-extract] ${msg}`);
}

const ARTIFACTS = new Set([
  'com',
  'dmail',
  'email',
  'www',
  'http',
  'https',
  'html',
  'gov',
  'org',
  'net',
  'edu',
  'pm',
  'am',
  'st',
  'nd',
  'rd',
  'th',
  'tel',
  'fax',
  'et',
  'al',
  'etc',
  'via',
  'vice',
  'versus'
]);

/** Split text into words, lowercase, filter non-alpha */
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(w => w && w.length > 2 && /^[a-z]/.test(w))
    .filter(w => !/'/.test(w) && !ARTIFACTS.has(w));
}

/** Strip common English suffixes for CEFR lookup */
function stemPlural(word) {
  if (word.endsWith('ies') && word.length > 5) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) return word.slice(0, -1);
  return word;
}

function stemComparison(word) {
  if (word.endsWith('est') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('er') && word.length > 4) return word.slice(0, -2);
  return word;
}

function cefrVerbStem(word, suffix) {
  const base = word.slice(0, -suffix.length);
  if (cefrSet.has(base)) return base;
  if (cefrSet.has(`${base}e`)) return `${base}e`;
  return word;
}

function stemVerb(word) {
  if (word.endsWith('ing') && word.length > 5) {
    const base = word.slice(0, -3);
    if (cefrSet.has(base)) return base;
    if (cefrSet.has(`${base}e`)) return `${base}e`;
  }
  if (word.endsWith('ed') && word.length > 4) return cefrVerbStem(word, 'ed');
  if (word.endsWith('ly') && word.length > 4) return word.slice(0, -2);
  return word;
}

function stemBasic(word) {
  for (const stemmer of [stemPlural, stemComparison, stemVerb]) {
    const stem = stemmer(word);
    if (stem !== word) return stem;
  }
  return word;
}

/** Check if a word is B1+ (not in A1-A2 list) */
function isB1Plus(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return false;
  if (cefrSet.has(w)) return false;
  const stem = stemBasic(w);
  if (stem !== w && cefrSet.has(stem)) return false;
  return true;
}

/** Remove ANSWER blocks */
function stripAnswers(text) {
  return text.replace(/\[ANSWER\][\s\S]*?\[\/ANSWER\]/gi, '');
}

/** Remove Markdown formatting artifacts */
function cleanText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~.+?~~/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[-*_]{3,}/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

// ── Subject-specific parsers ──

function shouldSkipReadingLine(line) {
  if (!line || /^\d+[.)]\s/.test(line) || /^[A-D][.)]\s/.test(line)) return true;
  if (/^##/.test(line)) return true;
  const instruction =
    /^(fill|complete|choose|select|read the email|date:|subject:|dear\s|see directions)/i;
  return instruction.test(line) || /^(contact us|your interview)/i.test(line);
}

function readingBlockText(block) {
  const lines = block.split('\n');
  const headerLine = lines[0]?.trim() || '';
  if (/Complete\s+the\s+Words/i.test(headerLine) || !/Read\s/i.test(headerLine)) return '';
  const bodyText = lines
    .slice(1)
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,2}\s+.*$/gm, '')
    .replace(/^---\s*$/gm, '\n')
    .replace(/\n{3,}/g, '\n\n');
  const cleanLines = [];
  for (const raw of bodyText.split('\n')) {
    const line = raw.trim();
    if (shouldSkipReadingLine(line)) continue;
    const cleaned = line
      .replace(/\w*_{2,}\w*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 15) cleanLines.push(cleaned);
  }
  return cleanLines.join(' ');
}

function parseReading(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = stripAnswers(content);

  // Split by tasks BEFORE cleaning (preserve ### markers for split)
  const taskBlocks = content.split(/(?=^### Task)/m);
  const segments = [];

  for (const block of taskBlocks) {
    const text = readingBlockText(block);
    if (text) segments.push(text);
  }

  return segments.filter(s => s.split(/\s+/).length > 15);
}

function listeningSpeakerText(line) {
  const match = line.match(
    /^(Man|Woman|Professor|Student|Podcast\s+Host|Interviewer|Speaker\s+[AB]):\s*(.+)/i
  );
  return match?.[2]?.trim() || '';
}

function resetsListeningBuffer(line) {
  return /^---/.test(line) || /^##/.test(line) || /^###/.test(line);
}

function ignoresListeningLine(line) {
  if (/^audio:/i.test(line) || /^>>\s*play:/i.test(line) || /^\[ANSWER\]/i.test(line)) return true;
  if (/^\d+[.)]\s/.test(line) || /^[A-D][.)]\s/.test(line)) return true;
  return (
    /^(what|which|when|where|why|how|according|the\s+speaker|listen)/i.test(line) &&
    line.length < 100
  );
}

function parseListening(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = stripAnswers(content);
  content = cleanText(content);

  const segments = [];
  const lines = content.split('\n');
  let buffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (resetsListeningBuffer(trimmed)) {
      buffer = [];
      continue;
    }
    if (ignoresListeningLine(trimmed)) continue;
    const text = listeningSpeakerText(trimmed);
    if (text.length > 10) buffer.push(text);
  }

  if (buffer.length > 0) segments.push(buffer.join(' '));
  return segments.filter(s => s.split(/\s+/).length > 5);
}

function writingSpeakerText(line) {
  const match = line.match(
    /^(Speaker\s+[AB]|Professor|Instructor|Student|Kelly|Andrew|Paul|Emily|Sarah|David|Anna|John|Maria|James|Lisa):/i
  );
  return match ? line.slice(match[0].length).trim().replace(/_{2,}/g, '________') : '';
}

function ignoresWritingLine(line) {
  return (
    /^\\?\[ANSWER\]/i.test(line) ||
    /^---/.test(line) ||
    /^Candidates:/i.test(line) ||
    /^To:\s/.test(line) ||
    /^Subject:\s/.test(line) ||
    /^Requirements:/i.test(line) ||
    /^(Identity:|Your\s+Role:)/i.test(line)
  );
}

function isWritingParagraph(line) {
  return line.length > 50 && !/^\d+[.)]/.test(line) && !/^[A-D][.)]/.test(line);
}

function parseWriting(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = stripAnswers(content);
  content = cleanText(content);

  const segments = [];
  const lines = content.split('\n');
  const buffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (ignoresWritingLine(trimmed)) continue;
    const speakerText = writingSpeakerText(trimmed);
    if (speakerText.length > 5 && !/^[A-D][.)]?\s/.test(speakerText)) buffer.push(speakerText);
    else if (isWritingParagraph(trimmed)) buffer.push(trimmed);
  }

  if (buffer.length > 0) segments.push(buffer.join(' '));
  return segments.filter(s => s.split(/\s+/).length > 5);
}

function parseSpeaking(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = cleanText(content);

  const segments = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Extract transcript values
    const transcriptMatch = trimmed.match(/^transcript:\s*(.+)/i);
    if (transcriptMatch) {
      const text = transcriptMatch[1].trim();
      if (text.length > 5) {
        segments.push(text);
      }
    }
  }

  return segments.filter(s => s.split(/\s+/).length > 3);
}

// ── Main extraction logic ──

function scanTpoFiles(subjectDir) {
  const dir = path.join(TPO_DIR, subjectDir);
  if (!fs.existsSync(dir)) return [];
  const tpoDirs = fs
    .readdirSync(dir)
    .filter(d => /^TPO-\d{2}$/i.test(d))
    .map(d => path.join(dir, d));
  const files = [];
  for (const tpoDir of tpoDirs) {
    const tpoName = path.basename(tpoDir);
    const mdFiles = fs.readdirSync(tpoDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    for (const mdFile of mdFiles) {
      files.push({
        fullPath: path.join(tpoDir, mdFile),
        tpo: tpoName,
        file: mdFile
      });
    }
  }
  return files.sort((a, b) => a.tpo.localeCompare(b.tpo));
}

function recordWord(word, sentences, source, wordFreq, wordSources) {
  if (!isB1Plus(word)) return;
  if (!wordFreq[word]) {
    wordFreq[word] = 0;
    wordSources[word] = { count: 0, examples: [], sources: [] };
  }
  wordFreq[word]++;
  const sentence = sentences.find(value => value.toLowerCase().includes(word));
  if (!sentence || wordSources[word].examples.length >= 3) return;
  const cleanExample = sentence.trim().replace(/\s+/g, ' ');
  if (wordSources[word].examples.includes(cleanExample)) return;
  wordSources[word].examples.push(cleanExample);
  wordSources[word].sources.push(source);
}

function extractFileVocabulary(file, parser, wordFreq, wordSources) {
  const source = `${file.tpo} ${file.file.replace(/\.md$/, '')}`;
  for (const segment of parser(file.fullPath)) {
    const sentences = segment.match(/[^.!?]+[.!?]+/g) || [segment];
    for (const word of new Set(tokenize(segment))) {
      recordWord(word, sentences, source, wordFreq, wordSources);
    }
  }
}

function extractVocabulary(subject) {
  const parsers = {
    reading: parseReading,
    listening: parseListening,
    writing: parseWriting,
    speaking: parseSpeaking
  };

  const parser = parsers[subject];
  if (!parser) throw new Error(`Unknown subject: ${subject}`);

  const files = scanTpoFiles(subject);
  log(`${subject}: found ${files.length} files`);

  const wordFreq = {}; // word -> { count, examples, sources }
  const wordSources = {};

  for (const file of files) extractFileVocabulary(file, parser, wordFreq, wordSources);

  // Filter by minimum frequency (remove noise/artifacts)
  const filteredWords = Object.entries(wordFreq).filter(([, freq]) => freq >= MIN_FREQ);

  // Sort by frequency (descending), then alphabetically
  const sortedWords = filteredWords.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  log(
    `${subject}: extracted ${sortedWords.length} B1+ words from ${Object.keys(wordFreq).length} candidates`
  );

  // Build word entries
  const entries = sortedWords.map(([word], index) => ({
    id: `vocab-${subject}-${String(index + 1).padStart(4, '0')}`,
    word,
    subject,
    pos: [],
    pronunciation: { us: '', uk: '' },
    inflections: { comparative: '', superlative: '', adverb: '', noun: '' },
    etymology: { prefix: null, root: null, suffix: null, summary: '' },
    rootGroup: null,
    example: wordSources[word]?.examples?.[0] || '',
    source: wordSources[word]?.sources?.[0] || ''
  }));

  // Divide into sets
  const sets = [];
  for (let i = 0; i < entries.length; i += SET_SIZE) {
    const setWords = entries.slice(i, i + SET_SIZE);
    sets.push({
      id: `set-${Math.floor(i / SET_SIZE) + 1}`,
      subject,
      startIndex: i + 1,
      endIndex: Math.min(i + SET_SIZE, entries.length),
      words: setWords
    });
  }

  log(`${subject}: split into ${sets.length} sets of up to ${SET_SIZE} words`);
  return { sets, entries };
}

// ── Output ──

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  log('Starting TPO vocabulary extraction...');
  log(`TPO directory: ${TPO_DIR}`);
  log(`Output directory: ${OUTPUT_DIR}`);
  log(`CEFR exclusion list: ${cefrSet.size} words`);
  log(`Words per set: ${SET_SIZE}\n`);

  ensureDir(OUTPUT_DIR);

  const subjects = ['reading', 'listening', 'writing', 'speaking'];
  const allStats = {};

  for (const subject of subjects) {
    log(`===== Processing ${subject} =====`);
    const result = extractVocabulary(subject);

    // Write full vocabulary JSON
    const outputPath = path.join(OUTPUT_DIR, `${subject}-words.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result.entries, null, 2), 'utf-8');
    log(`Wrote ${outputPath} (${result.entries.length} words)`);

    allStats[subject] = {
      totalWords: result.entries.length,
      totalSets: result.sets.length
    };
  }

  // Write summary
  log('\n===== Extraction complete =====');
  for (const [subject, stats] of Object.entries(allStats)) {
    log(`${subject}: ${stats.totalWords} words across ${stats.totalSets} sets`);
  }

  const grandTotal = Object.values(allStats).reduce((s, v) => s + v.totalWords, 0);
  const grandSets = Object.values(allStats).reduce((s, v) => s + v.totalSets, 0);
  log(`Total: ${grandTotal} words across ${grandSets} sets`);

  const manifest = {};
  for (const subject of subjects) {
    const entries = JSON.parse(
      fs.readFileSync(path.join(OUTPUT_DIR, `${subject}-words.json`), 'utf-8')
    );
    manifest[subject] = entries.length;
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  log(`Wrote ${path.join(OUTPUT_DIR, 'manifest.json')}`);
}

main().catch(err => {
  console.error('[extract-vocabulary] FATAL:', err);
  process.exit(1);
});
