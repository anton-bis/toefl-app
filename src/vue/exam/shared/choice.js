export function selectedAnswer(answers, questionId) {
  return answers && typeof answers === 'object' ? (answers[questionId] ?? '') : '';
}

export function checkedQuestion(checked, questionId) {
  if (checked === true) return true;
  if (Array.isArray(checked)) return checked.includes(questionId);
  return Boolean(checked && typeof checked === 'object' && checked[questionId]);
}

export function optionState(question, answers, checked, locked, optionId) {
  const selected = selectedAnswer(answers, question.id);
  if (!checkedQuestion(checked, question.id)) {
    const classes = selected === optionId ? ['selected'] : [];
    if (checkedQuestion(locked, question.id)) classes.push('locked');
    return classes.join(' ');
  }
  if (optionId === question.answer) return 'correct locked';
  if (selected === optionId) return 'incorrect locked';
  return 'locked';
}
