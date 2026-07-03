import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

var SUBJECTS = ['reading', 'writing'];
var BATCH_DIR = 'assets/questions/vocabulary/alt-batches/';

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

if (!existsSync(BATCH_DIR)) mkdirSync(BATCH_DIR, { recursive: true });
var batchFiles = readdirSync(BATCH_DIR).filter(function (f) { return f.endsWith('.json'); });
console.log('Found ' + batchFiles.length + ' batch files');

var allExamples = {};
for (var f of batchFiles) {
  try {
    var data = JSON.parse(readFileSync(path.join(BATCH_DIR, f), 'utf-8'));
    for (var word in data) {
      allExamples[word.toLowerCase()] = data[word];
    }
    console.log('  Loaded ' + Object.keys(data).length + ' words from ' + f);
  } catch (e) {
    console.log('  Error loading ' + f + ': ' + e.message);
  }
}

console.log('Total words with altExamples: ' + Object.keys(allExamples).length);

for (var s of SUBJECTS) {
  var words = load(s);
  var count = 0;
  for (var w of words) {
    var matchKey = w.word.toLowerCase();
    if (allExamples[matchKey] && allExamples[matchKey].altExamples) {
      w.altExamples = allExamples[matchKey].altExamples;
      count++;
    }
  }
  save(s, words);
  console.log(s + ': updated ' + count + ' words');
}

console.log('Done');
