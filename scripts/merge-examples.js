import { readFileSync, readdirSync, writeFileSync } from 'fs';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];
var BATCH_DIR = 'assets/questions/vocabulary/ex-batches/';

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

var loadedData = {};
for (var s of SUBJECTS) {
  loadedData[s] = load(s);
}

// Build word → entry map per subject
var maps = {};
for (var s of SUBJECTS) {
  maps[s] = {};
  loadedData[s].forEach(function (w) {
    maps[s][w.word] = w;
  });
}

var batchFiles = readdirSync(BATCH_DIR).filter(function (f) { return f.endsWith('.json'); }).sort();
var translated = 0;
var skipped = 0;

for (var f of batchFiles) {
  try {
    var batch = JSON.parse(readFileSync(BATCH_DIR + f, 'utf-8'));
    var subject = batch.subject;
    var wordMap = maps[subject];
    if (!wordMap) { console.log('Unknown subject in ' + f + ': ' + subject); continue; }

    var entries = batch.words || {};
    for (var wordName in entries) {
      var exData = entries[wordName];
      var w = wordMap[wordName];
      if (!w) { console.log('Word not found: ' + wordName + ' in ' + subject); skipped++; continue; }

      if (exData.example_cn) {
        w.example_cn = exData.example_cn;
      }
      if (exData.altExamples_cn && exData.altExamples_cn.length > 0) {
        w.altExamples_cn = exData.altExamples_cn;
      }
      translated++;
    }
  } catch (e) {
    console.log('Error processing ' + f + ': ' + e.message);
  }
}

console.log('Translated examples for ' + translated + ' words');
console.log('Skipped ' + skipped);

for (var s of SUBJECTS) {
  save(s, loadedData[s]);
  var withCn = loadedData[s].filter(function (w) { return !!w.example_cn; }).length;
  console.log(s + ': ' + withCn + '/' + loadedData[s].length + ' have example_cn');
}
