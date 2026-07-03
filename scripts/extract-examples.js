import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];
var OUT_DIR = 'assets/questions/vocabulary/ex-batches/';
var BATCH_SIZE = 80;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

var globalIdx = 0;

for (var s of SUBJECTS) {
  var fp = 'assets/questions/vocabulary/' + s + '-words.json';
  var words = JSON.parse(readFileSync(fp, 'utf-8'));

  for (var i = 0; i < words.length; i += BATCH_SIZE) {
    var chunk = words.slice(i, i + BATCH_SIZE);
    var batch = { subject: s, start: i, words: {} };

    for (var w of chunk) {
      batch.words[w.word] = {
        example: w.example || '',
        altExamples: w.altExamples || []
      };
    }

    var bid = String(globalIdx).padStart(3, '0');
    var outPath = OUT_DIR + 'ex-batch-' + bid + '.json';
    writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf-8');
    console.log('Wrote ' + outPath + ' (' + Object.keys(batch.words).length + ' words, subject=' + s + ')');
    globalIdx++;
  }
}

console.log('\nTotal batches: ' + globalIdx);
