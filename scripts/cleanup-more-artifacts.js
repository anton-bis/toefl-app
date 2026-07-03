import { readFileSync, writeFileSync } from 'fs';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];

for (var s of SUBJECTS) {
  var w = JSON.parse(readFileSync('assets/questions/vocabulary/' + s + '-words.json', 'utf-8'));
  var before = w.length;

  w = w.filter(function(x) {
    var ex = (x.example || '').toLowerCase();
    if (ex.includes('com from') || ex.includes('to:') || ex.includes('from:')) {
      console.log(s + ': removing "' + x.word + '" (email remainder)');
      return false;
    }
    if (x.word.toLowerCase() === 'santos') {
      console.log(s + ': removing "' + x.word + '" (email remainder)');
      return false;
    }
    return true;
  });

  if (before !== w.length) {
    writeFileSync('assets/questions/vocabulary/' + s + '-words.json', JSON.stringify(w, null, 2), 'utf-8');
    console.log(s + ': ' + before + ' → ' + w.length);
  }
}

// Update index
var idx = JSON.parse(readFileSync('assets/questions/vocabulary/index.json', 'utf-8'));
for (var s of SUBJECTS) {
  var w = JSON.parse(readFileSync('assets/questions/vocabulary/' + s + '-words.json', 'utf-8'));
  idx[s].totalWords = w.length;
  idx[s].totalSets = Math.ceil(w.length / idx[s].setSize);
}
writeFileSync('assets/questions/vocabulary/index.json', JSON.stringify(idx, null, 2), 'utf-8');
console.log('Index updated');
