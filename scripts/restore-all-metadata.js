import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];
var BATCH_DIR = 'assets/questions/vocabulary/meta-batches/';

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

// Load altExamples backup
var altBackup = {};
try {
  altBackup = JSON.parse(readFileSync('assets/questions/vocabulary/alt-examples-backup.json', 'utf-8'));
} catch (e) {
  console.log('No altExamples backup found');
}

// Load all vocab data into memory
var loadedData = {};
for (var s of SUBJECTS) {
  loadedData[s] = load(s);
}

// Build word → {subject, wordObj} map
var wordMap = {};
for (var s of SUBJECTS) {
  loadedData[s].forEach(function(w) {
    wordMap[w.word.toLowerCase()] = { subject: s, word: w };
  });
}

// Read all metadata batch files
var metaFiles = readdirSync(BATCH_DIR).filter(function(f) { return f.endsWith('.json'); }).sort();
console.log('Found ' + metaFiles.length + ' metadata batch files');

var updated = 0;
var noMatch = [];

for (var f of metaFiles) {
  try {
    var raw = readFileSync(path.join(BATCH_DIR, f), 'utf-8');
    var batch = JSON.parse(raw);
    // Handle wrapped format {subject: "reading", words: {word: {...}}}
    var entries = batch.words || batch;
    for (var word in entries) {
      var meta = entries[word];
      if (!meta || typeof meta !== 'object') continue;

      var match = wordMap[word.toLowerCase()];
      if (!match) { noMatch.push(word); continue; }

      var w = match.word;
      if (meta.pos && Array.isArray(meta.pos) && meta.pos.length > 0) {
        w.pos = meta.pos;
      }
      if (meta.pronunciation) {
        w.pronunciation = { us: meta.pronunciation.us || '', uk: meta.pronunciation.uk || '' };
      }
      if (meta.inflections) {
        w.inflections = meta.inflections;
      }
      if (meta.etymology) {
        w.etymology = meta.etymology;
      }
      updated++;
    }
  } catch (e) {
    console.log('Error processing ' + f + ': ' + e.message);
  }
}

console.log('Updated metadata for ' + updated + ' word entries');
if (noMatch.length > 0) {
  console.log('No match for ' + noMatch.length + ' words: ' + noMatch.slice(0, 10).join(', '));
}

// Restore altExamples
var altRestored = 0;
for (var key in altBackup) {
  var parts = key.split(':');
  if (parts.length !== 2) continue;
  var subject = parts[0];
  var wordName = parts[1];
  var words = loadedData[subject];
  if (!words) continue;
  var found = words.find(function(w) { return w.word.toLowerCase() === wordName.toLowerCase(); });
  if (found) {
    found.altExamples = altBackup[key];
    altRestored++;
  }
}
console.log('Restored altExamples for ' + altRestored + ' words');

// ---- Backfill: propagate metadata for shell entries ----

function singularize(word) {
  var w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
  if (w.endsWith('ches') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('shes') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('xes') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('zzes') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('sses') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    return w.slice(0, -1);
  }
  return null;
}

function verbBase(word) {
  var w = word.toLowerCase();
  if (w.endsWith('ing') && w.length > 5) {
    var dropped = w.slice(0, -3);
    if (dropped.length > 2 && dropped[dropped.length - 1] === dropped[dropped.length - 2]) return dropped.slice(0, -1);
    return dropped + 'e';
  }
  if (w.endsWith('ed') && w.length > 4 && !w.endsWith('eed')) {
    var dropped = w.slice(0, -2);
    if (dropped.length > 2 && dropped[dropped.length - 1] === dropped[dropped.length - 2]) return dropped.slice(0, -1);
    return dropped + 'e';
  }
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    return w.slice(0, -1);
  }
  return null;
}

function isEmptyEntry(w) {
  var noPos = !w.pos || w.pos.length === 0;
  var noPron = !w.pronunciation || !w.pronunciation.us;
  return noPos || noPron;
}

function copyMeta(src, dst) {
  if (!src) return false;
  var changed = false;
  if ((!dst.pos || dst.pos.length === 0) && src.pos && src.pos.length > 0) {
    dst.pos = JSON.parse(JSON.stringify(src.pos));
    changed = true;
  }
  if ((!dst.pronunciation || !dst.pronunciation.us) && src.pronunciation && src.pronunciation.us) {
    dst.pronunciation = { us: src.pronunciation.us, uk: src.pronunciation.uk || '' };
    changed = true;
  }
  if (!dst.inflections || Object.keys(dst.inflections).every(function(k) { return !dst.inflections[k]; })) {
    if (src.inflections) {
      dst.inflections = JSON.parse(JSON.stringify(src.inflections));
      changed = true;
    }
  }
  if ((!dst.etymology || (!dst.etymology.prefix && !dst.etymology.root && !dst.etymology.suffix && !dst.etymology.summary))
      && src.etymology) {
    dst.etymology = JSON.parse(JSON.stringify(src.etymology));
    changed = true;
  }
  return changed;
}

// Build multi-subject map: word → [{subject, wordObj}]
var crossMap = {};
for (var s of SUBJECTS) {
  loadedData[s].forEach(function(w) {
    var key = w.word.toLowerCase();
    if (!crossMap[key]) crossMap[key] = [];
    crossMap[key].push({ subject: s, word: w });
  });
}

var backfillCount = 0;
var deriveCount = 0;

for (var s of SUBJECTS) {
  loadedData[s].forEach(function(w) {
    if (!isEmptyEntry(w)) return;

    // 1. Look for same word in other subjects with metadata
    var crossEntries = crossMap[w.word.toLowerCase()] || [];
    for (var c of crossEntries) {
      if (c.subject === s) continue;
      if (copyMeta(c.word, w)) backfillCount++;
      if (!isEmptyEntry(w)) break;
    }

    // 2. Try to derive from base form
    if (isEmptyEntry(w)) {
      var base = singularize(w.word) || verbBase(w.word);
      if (base && base !== w.word.toLowerCase()) {
        var baseEntries = crossMap[base] || [];
        for (var b of baseEntries) {
          if (copyMeta(b.word, w)) { deriveCount++; break; }
        }
      }
    }

    // 3. Also try 'e'-drop variants (e.g., affecting → affect)
    if (isEmptyEntry(w)) {
      var lower = w.word.toLowerCase();
      if (lower.endsWith('ing') && lower.length > 5) {
        var alt1 = lower.slice(0, -3);              // affecting → affect
        var alt2 = lower.slice(0, -4) + 'e';        // affecting → affecte... no
        forEachVariant(alt1, alt2);
      }
      if (isEmptyEntry(w) && lower.endsWith('ed') && lower.length > 4) {
        var alt1e = lower.slice(0, -2);              // affected → affected
        var alt2e = lower.slice(0, -3);              // affected → affect
        forEachVariant(alt1e, alt2e);
      }
    }

    function forEachVariant(a, b) {
      [a, b].forEach(function(v) {
        if (!isEmptyEntry(w)) return;
        var entries = crossMap[v] || [];
        for (var e of entries) {
          if (copyMeta(e.word, w)) { deriveCount++; break; }
        }
      });
    }
  });
}

console.log('Backfilled ' + backfillCount + ' entries from cross-subject');
console.log('Derived ' + deriveCount + ' entries from base forms');

// Save all modified data
for (var s of SUBJECTS) {
  save(s, loadedData[s]);
}
console.log('All files saved');
