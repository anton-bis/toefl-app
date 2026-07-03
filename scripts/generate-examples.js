import { readFileSync, writeFileSync } from 'fs';

var SUBJECTS = ['reading', 'writing'];

// Words with bad/short examples that need altExamples
// Each gets 2 additional C1-level TOEFL-style examples
var ALT_EXAMPLES = {
  admission: [
    'The university requires all applicants to submit their admission materials by the December deadline.',
    'Admission to the conference is limited to registered participants only.'
  ],
  afterward: [
    'The experiment concluded successfully; afterward, the researchers analyzed the data for several weeks.',
    'She graduated from university in 2020 and afterward pursued a career in environmental science.'
  ],
  campground: [
    'The campground was equipped with modern facilities, including showers and a small grocery store.',
    'They reserved a spot at the national park campground for their summer vacation.'
  ],
  superstore: [
    'The new superstore offers a wide range of electronics, groceries, and household items under one roof.',
    'Local small businesses struggled to compete after the superstore opened on the outskirts of town.'
  ],
  annoying: [
    'The repetitive noise from the construction site became increasingly annoying as the days went by.',
    'One of the most annoying aspects of online meetings is the frequent technical difficulties.'
  ],
  frustrating: [
    'It can be frustrating when a well-prepared presentation fails due to equipment malfunction.',
    'Students often find it frustrating to memorize vocabulary without meaningful context.'
  ],
  huh: [
    '"Huh, I never realized how much the ecosystem depends on these tiny organisms," the biologist remarked.',
    'He looked at the complex equation and muttered, "Huh, this is more challenging than I expected."'
  ],
  flew: [
    'The archaeological team flew to the remote excavation site to investigate the newly discovered ruins.',
    'As the plane flew over the Grand Canyon, passengers marveled at the breathtaking landscape.'
  ],
  convenient: [
    'Online learning platforms offer a convenient way for students to access educational resources from anywhere.',
    'The convenient location of the new library makes it a popular study spot among university students.'
  ],
  laptop: [
    'Most university students rely on a laptop for research, writing papers, and attending virtual classes.',
    'She accidentally left her laptop in the library and realized it contained all her thesis data.'
  ],
  scarf: [
    'She wore a warm woolen scarf to protect herself from the cold winter wind during her morning commute.',
    'The designer scarf, made from sustainable materials, became a popular fashion accessory.'
  ]
};

function load(subject) {
  return JSON.parse(readFileSync('assets/questions/vocabulary/' + subject + '-words.json', 'utf-8'));
}

function save(subject, data) {
  writeFileSync('assets/questions/vocabulary/' + subject + '-words.json', JSON.stringify(data, null, 2), 'utf-8');
}

var totalAdded = 0;

for (var s of SUBJECTS) {
  var words = load(s);

  for (var w of words) {
    var lower = w.word.toLowerCase();

    if (ALT_EXAMPLES[lower]) {
      w.altExamples = ALT_EXAMPLES[lower];
      totalAdded++;
      console.log(s + ': added altExamples for "' + w.word + '"');
    }

    // Also ensure every Reading/Writing word has at least a proper example
    var ex = (w.example || '').trim();
    if (ex === '' || ex.length < 20) {
      console.log(s + ': WARNING "' + w.word + '" has no example');
    }
  }

  save(s, words);
}

console.log('\nTotal altExamples added: ' + totalAdded);
console.log('Note: More examples can be generated in future runs by extending ALT_EXAMPLES.');
