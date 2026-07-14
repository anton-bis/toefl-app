export function selectedAnswer(answers, questionId) {
  return answers && typeof answers === 'object' ? (answers[questionId] ?? '') : '';
}

export function checkedQuestion(checked, questionId) {
  if (checked === true) return true;
  if (Array.isArray(checked)) return checked.includes(questionId);
  return Boolean(checked && typeof checked === 'object' && checked[questionId]);
}

export function optionState(question, answers, checked, optionId) {
  const selected = selectedAnswer(answers, question.id);
  if (!checkedQuestion(checked, question.id)) return selected === optionId ? 'selected' : '';
  if (optionId === question.answer) return 'correct locked';
  if (selected === optionId) return 'incorrect locked';
  return 'locked';
}
