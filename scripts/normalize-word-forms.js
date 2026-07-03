import { readFileSync, writeFileSync } from 'fs';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];
var LOG = [];

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

// Singularize a plural noun
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
  return null; // not determinable
}

// Derive base form from verb inflection
function verbBase(word) {
  var w = word.toLowerCase();
  if (w.endsWith('ing') && w.length > 5) {
    var dropped = w.slice(0, -3);
    // running → run
    if (dropped.length > 2 && dropped[dropped.length - 1] === dropped[dropped.length - 2]) {
      return [dropped.slice(0, -1)];
    }
    // loving → love, blending → blend
    return [dropped, dropped + 'e'];
  }
  if (w.endsWith('ed') && w.length > 4 && !w.endsWith('eed')) {
    var dropped = w.slice(0, -2);
    if (dropped.length > 2 && dropped[dropped.length - 1] === dropped[dropped.length - 2]) {
      return [dropped.slice(0, -1)];
    }
    return [dropped, dropped + 'e'];
  }
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is') && w.length > 3) {
    return [w.slice(0, -1)];
  }
  return [];
}

// Words that are proper names and should never be touched
var PROPER_NAMES = new Set([
  'evans', 'aristophanes', 'simmons', 'santos', 'russos', 'orleans', 'egyptians',
  'greeks', 'romans', 'viking', 'vikings', 'gardnerjardinero'
]);

// Words that should remain as-is because they're more natural in that form
var KEEP_AS_IS = new Set([
  'electronics', 'bacteria', 'gastroenteritis', 'tuberculosis', 'thesis', 'basis',
  'olympics', 'headphones', 'shoes', 'pants'
]);

function normalize() {
  for (var subject of SUBJECTS) {
    var words = load(subject);
    var keep = [];
    var removals = [];

    // Build a map of base forms in this subject
    var baseMap = {};
    for (var w of words) {
      baseMap[w.word.toLowerCase()] = w;
    }

    for (var w of words) {
      var lower = w.word.toLowerCase();
      var action = 'keep';

      // Skip proper names and special cases
      if (PROPER_NAMES.has(lower) || KEEP_AS_IS.has(lower)) {
        keep.push(w);
        continue;
      }

      // Check if this is a plural noun with base form in corpus
      var singular = singularize(lower);
      if (singular && singular !== lower && baseMap[singular]) {
        var baseWord = baseMap[singular];
        // Check if inflected form has additional meanings
        var hasExtra = false;
        for (var p of w.pos) {
          var found = baseWord.pos.some(function (bp) {
            return bp.type === p.type && bp.translation === p.translation;
          });
          if (!found) { hasExtra = true; break; }
        }
        if (!hasExtra) {
          LOG.push(subject + ': REMOVED "' + w.word + '" (plural of "' + baseWord.word + '")');
          action = 'remove';
        }
      }

      // Check verb inflection with base form in corpus
      if (action === 'keep') {
        var bases = verbBase(lower);
        for (var bi = 0; bi < bases.length; bi++) {
          var base = bases[bi];
          if (!base || base === lower || !baseMap[base]) continue;
          var baseWord = baseMap[base];
          var hasExtraV = false;
          for (var p of w.pos) {
            var foundV = baseWord.pos.some(function (bp) {
              return bp.type === p.type && bp.translation === p.translation;
            });
            if (!foundV) { hasExtraV = true; break; }
          }
          if (!hasExtraV) {
            LOG.push(subject + ': REMOVED "' + w.word + '" (verb form of "' + baseWord.word + '")');
            action = 'remove';
            break;
          }
        }
      }

      if (action === 'keep') {
        keep.push(w);
      } else {
        removals.push(w.word);
      }
    }

    LOG.push(subject + ': ' + removals.length + ' removed, ' + keep.length + ' kept');
    save(subject, keep);
  }
}

normalize();
console.log(LOG.join('\n'));
