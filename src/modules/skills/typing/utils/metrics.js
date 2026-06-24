export function computeMetrics(scores) {
  var correctCount = scores.correctCount;
  var incorrectCount = scores.incorrectCount;
  var totalChars = scores.totalChars;
  var timeMs = scores.timeSpent;
  var chars = scores.chars;

  var minutes = Math.max(timeMs / 60000, 0.01);
  var rawWpm = (totalChars / 5) / minutes;
  var netWpm = ((totalChars - incorrectCount) / 5) / minutes;
  var accuracy = totalChars > 0 ? (correctCount / totalChars) * 100 : 0;

  var errors = { spacing: 0, capitalization: 0, spelling: 0, punctuation: 0 };
  for (var i = 0; i < chars.length; i++) {
    if (chars[i].status !== 'incorrect') continue;
    var cat = classifyError(chars[i].char, chars[i].expected);
    errors[cat]++;
  }

  return {
    rawWpm: Math.round(rawWpm * 10) / 10,
    netWpm: Math.round(netWpm * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    errors: errors,
    totalChars: totalChars,
    correctCount: correctCount,
    incorrectCount: incorrectCount
  };
}

function classifyError(inputChar, expectedChar) {
  if (expectedChar === ' ' || (inputChar === ' ' && expectedChar !== ' ')) {
    return 'spacing';
  }

  if (expectedChar.toLowerCase() === inputChar.toLowerCase() &&
      expectedChar !== inputChar) {
    return 'capitalization';
  }

  if (/[^\w\s]/.test(expectedChar) || /[^\w\s]/.test(inputChar)) {
    return 'punctuation';
  }

  return 'spelling';
}
