/**
 * Generate word-roots.json from etymology data
 */
import fs from 'fs';

const VOCAB_DIR = 'assets/questions/vocabulary';
const roots = {};

for (const subject of ['reading', 'listening', 'writing', 'speaking']) {
  const filePath = `${VOCAB_DIR}/${subject}-words.json`;
  if (!fs.existsSync(filePath)) continue;
  const words = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const w of words) {
    if (!w.etymology || !w.etymology.prefix && !w.etymology.root && !w.etymology.suffix) continue;
    const parts = [w.etymology.prefix, w.etymology.root, w.etymology.suffix].filter(Boolean);
    for (const part of parts) {
      const key = part.form;
      if (!key) continue;
      if (!roots[key]) {
        roots[key] = {
          meaning: part.meaning || '',
          type: key.endsWith('-') ? 'prefix' : key.startsWith('-') ? 'suffix' : 'root',
          words: []
        };
      }
      if (!roots[key].words.includes(w.word)) {
        roots[key].words.push(w.word);
      }
    }
  }
}

// Filter: keep roots with at least 1 word
const filtered = {};
for (const [key, val] of Object.entries(roots)) {
  if (val.words.length >= 1) filtered[key] = val;
}

const outputPath = `${VOCAB_DIR}/word-roots.json`;
fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), 'utf-8');
console.log(`word-roots.json: ${Object.keys(filtered).length} roots/affixes generated`);
