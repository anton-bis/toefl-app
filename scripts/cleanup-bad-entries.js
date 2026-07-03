import { readFileSync, writeFileSync } from 'fs';

var SUBJECTS = ['reading', 'listening', 'writing', 'speaking'];

// Person names extracted from emails — not real vocabulary
var NAME_WORDS = new Set([
  'emily', 'evans', 'jane', 'liu', 'michael', 'novak', 'patel', 'santiago',
  'simmons', 'smith', 'sally', 'lily', 'emmaj', 'branscomb', 'lakside',
  'labella', 'lakeside',
  'edward',
  'ben', 'bernal', 'cynthia', 'gladstone', 'janet', 'julie', 'max', 'orleans', 'waldman',
  'chen', 'diaz', 'emma', 'gupta', 'marcus', 'achebe', 'andre', 'anna', 'evan', 'gustavo',
  'jenna', 'julio', 'liam', 'maria', 'mariana', 'martha', 'matthew', 'ruby'
]);

// Words to fix
var KNOWN_FIXES = {
  afterword: { subject: 'writing', fix: { example: 'She finished her homework shortly afterward.', source: 'manually revised' } },
  afterward: { subject: 'writing', fix: { example: 'She finished her homework shortly afterward.', source: 'manually revised' } },
  campground: { subject: 'writing', fix: { example: 'We set up our tent at the campground near the lake.', source: 'manually revised' } },
  superstore: { subject: 'writing', fix: { example: 'The new superstore offers a wide variety of products at discounted prices.', source: 'manually revised' } },
  admission: { subject: 'reading', fix: { example: 'Admission to the museum is free on the first Sunday of every month.', source: 'manually revised' } },
  annoying: { subject: 'listening', fix: { example: 'The constant buzzing of the phone was incredibly annoying during the meeting.', source: 'manually revised' } },
  frustrating: { subject: 'listening', fix: { example: 'It was frustrating to lose the game after leading for most of the match.', source: 'manually revised' } },
  huh: { subject: 'listening', fix: { example: '"Huh, I never knew that!" she exclaimed in surprise.', source: 'manually revised' } },
  flew: { subject: 'listening', fix: { example: 'The bird flew across the sky and disappeared into the clouds.', source: 'manually revised' } }
};

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

var totalRemoved = 0;
var totalFixed = 0;

for (var s of SUBJECTS) {
  var words = load(s);
  var keep = [];

  for (var w of words) {
    var lower = w.word.toLowerCase();
    var ex = (w.example || '').toLowerCase();

    // Remove email artifacts: example contains @ or dmail
    if (ex.includes('@') || ex.includes('dmail')) {
      totalRemoved++;
      console.log(s + ': REMOVED "' + w.word + '" (email artifact)');
      continue;
    }

    // Remove known name words
    if (NAME_WORDS.has(lower)) {
      totalRemoved++;
      console.log(s + ': REMOVED "' + w.word + '" (person name)');
      continue;
    }

    // Fix examples
    var fixKey = KNOWN_FIXES[lower];
    if (fixKey && fixKey.subject === s) {
      Object.assign(w, fixKey.fix);
      totalFixed++;
      console.log(s + ': FIXED "' + w.word + '"');
    }

    keep.push(w);
  }

  save(s, keep);
  console.log(s + ': ' + words.length + ' → ' + keep.length);
}

// Update index.json
var index = JSON.parse(readFileSync('assets/questions/vocabulary/index.json', 'utf-8'));
for (var s of SUBJECTS) {
  var words = load(s);
  index[s].totalWords = words.length;
  index[s].totalSets = Math.ceil(words.length / index[s].setSize);
}
writeFileSync('assets/questions/vocabulary/index.json', JSON.stringify(index, null, 2), 'utf-8');

console.log('\nTotal removed: ' + totalRemoved + ', Total fixed: ' + totalFixed);
