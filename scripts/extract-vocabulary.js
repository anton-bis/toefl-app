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
function log(msg) { console.log(`[vocab-extract] ${msg}`); }

const ARTIFACTS = new Set([
  'com', 'dmail', 'email', 'www', 'http', 'https', 'html', 'gov', 'org', 'net', 'edu',
  'pm', 'am', 'st', 'nd', 'rd', 'th', 'tel', 'fax', 'et', 'al', 'etc',
  'via', 'vice', 'versus',
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
function stemBasic(word) {
  let w = word;
  if (w.endsWith('ies') && w.length > 5) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 4) return w.slice(0, -1);
  if (w.endsWith('est') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ing') && w.length > 5) {
    const base = w.slice(0, -3);
    if (cefrSet.has(base)) return base;
    if (cefrSet.has(base + 'e')) return base + 'e';
  }
  if (w.endsWith('ed') && w.length > 4) {
    const base = w.slice(0, -2);
    if (cefrSet.has(base)) return base;
    if (cefrSet.has(base + 'e')) return base + 'e';
  }
  if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
  return w;
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

function parseReading(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = stripAnswers(content);

  // Split by tasks BEFORE cleaning (preserve ### markers for split)
  const taskBlocks = content.split(/(?=^### Task)/m);
  const segments = [];

  for (const block of taskBlocks) {
    const lines = block.split('\n');
    const headerLine = lines[0]?.trim() || '';
    const body = lines.slice(1).join('\n');

    // Skip "Complete the Words" tasks — text has corrupted blanks
    if (/Complete\s+the\s+Words/i.test(headerLine)) continue;

    // Only process "Read" tasks
    if (!/Read\s/i.test(headerLine)) continue;

    // Clean body text (mild version, preserve ###)
    const bodyText = body
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,2}\s+.*$/gm, '')  // Strip ## and # lines, keep ### Task lines
      .replace(/^---\s*$/gm, '\n')
      .replace(/\n{3,}/g, '\n\n');

    const bodyLines = bodyText.split('\n');
    const cleanLines = [];

    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Skip questions and options
      if (/^\d+[\.\)]\s/.test(trimmed)) continue;
      if (/^[A-D][\.\)]\s/.test(trimmed)) continue;
      // Skip instructions and email metadata
      if (/^(fill|complete|choose|select|read the email|date:|subject:|dear\s|see directions|contact us|your interview)/i.test(trimmed)) continue;
      // Skip headers
      if (/^##/.test(trimmed)) continue;

      let cleaned = trimmed
        .replace(/\w*_{2,}\w*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length > 15) cleanLines.push(cleaned);
    }

    if (cleanLines.length > 0) {
      segments.push(cleanLines.join(' '));
    }
  }

  return segments.filter(s => s.split(/\s+/).length > 15);
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
    // Skip metadata lines
    if (/^audio:/i.test(trimmed)) continue;
    if (/^>>\s*play:/i.test(trimmed)) continue;
    if (/^\[ANSWER\]/i.test(trimmed)) continue;
    if (/^---/.test(trimmed)) { buffer = []; continue; }
    if (/^##/.test(trimmed)) { buffer = []; continue; }
    if (/^###/.test(trimmed)) { buffer = []; continue; }

    // Check if this is a dialogue line with speaker label
    const speakerMatch = trimmed.match(/^(Man|Woman|Professor|Student|Podcast\s+Host|Interviewer|Speaker\s+[AB]):\s*(.+)/i);
    if (speakerMatch) {
      const text = speakerMatch[2].trim();
      if (text.length > 10) {
        buffer.push(text);
      }
      continue;
    }

    // Skip question numbers and options
    if (/^\d+[\.\)]\s/.test(trimmed)) continue;
    if (/^[A-D][\.\)]\s/.test(trimmed)) continue;
    if (/^(what|which|when|where|why|how|according|the\s+speaker|listen)/i.test(trimmed) && trimmed.length < 100) continue;
  }

  if (buffer.length > 0) segments.push(buffer.join(' '));
  return segments.filter(s => s.split(/\s+/).length > 5);
}

function parseWriting(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = stripAnswers(content);
  content = cleanText(content);

  const segments = [];
  const lines = content.split('\n');
  let buffer = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\\?\[ANSWER\]/i.test(trimmed)) continue;
    if (/^---/.test(trimmed)) continue;
    if (/^Candidates:/i.test(trimmed)) continue;
    if (/^To:\s/.test(trimmed)) continue;
    if (/^Subject:\s/.test(trimmed)) continue;
    if (/^Requirements:/i.test(trimmed)) continue;
    if (/^(Identity:|Your\s+Role:)/i.test(trimmed)) continue;

    // Speaker lines (Build a Sentence)
    const speakerMatch = trimmed.match(/^(Speaker\s+[AB]|Professor|Instructor|Student|Kelly|Andrew|Paul|Emily|Sarah|David|Anna|John|Maria|James|Lisa):\s*(.+)/i);
    if (speakerMatch) {
      let text = speakerMatch[2].trim();
      // Remove blank placeholders but keep surrounding text
      text = text.replace(/_{2,}/g, '________');
      if (text.length > 5 && !/^[A-D][\.\)]?\s/.test(text)) {
        buffer.push(text);
      }
      continue;
    }

    // If it's a long paragraph (potential academic discussion)
    if (trimmed.length > 50 && !/^\d+[\.\)]/.test(trimmed) && !/^[A-D][\.\)]/.test(trimmed)) {
      buffer.push(trimmed);
    }
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
  const tpoDirs = fs.readdirSync(dir)
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

  const wordFreq = {};  // word -> { count, examples, sources }
  const wordSources = {};

  for (const { fullPath, tpo, file } of files) {
    const segments = parser(fullPath);
    for (const segment of segments) {
      // Extract sentences
      const sentences = segment.match(/[^.!?]+[.!?]+/g) || [segment];
      const words = tokenize(segment);
      const uniqueWords = [...new Set(words)];

      for (const word of uniqueWords) {
        if (!isB1Plus(word)) continue;
        if (!wordFreq[word]) {
          wordFreq[word] = 0;
          wordSources[word] = { count: 0, examples: [], sources: [] };
        }
        wordFreq[word]++;

        // Find original sentence as example
        const sentence = sentences.find(s =>
          s.toLowerCase().includes(word)
        );
        if (sentence && wordSources[word].examples.length < 3) {
          const cleanEx = sentence.trim().replace(/\s+/g, ' ');
          if (!wordSources[word].examples.includes(cleanEx)) {
            wordSources[word].examples.push(cleanEx);
            wordSources[word].sources.push(`${tpo} ${file.replace(/\.md$/, '')}`);
          }
        }
      }
    }
  }

  // Filter by minimum frequency (remove noise/artifacts)
  const filteredWords = Object.entries(wordFreq)
    .filter(([, freq]) => freq >= MIN_FREQ);

  // Sort by frequency (descending), then alphabetically
  const sortedWords = filteredWords
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  log(`${subject}: extracted ${sortedWords.length} B1+ words from ${Object.keys(wordFreq).length} candidates`);

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
    const entries = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, `${subject}-words.json`), 'utf-8'));
    manifest[subject] = entries.length;
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  log(`Wrote ${path.join(OUTPUT_DIR, 'manifest.json')}`);
}

main().catch(err => {
  console.error('[extract-vocabulary] FATAL:', err);
  process.exit(1);
});
