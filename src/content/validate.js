/** Validate an ExamDocument without coupling validation to rendering. */
export function validateExamDocument(document) {
  const errors = [];
  const warnings = [];
  const questionIds = new Set();

  if (!document?.id || !document?.tpoId || !document?.section)
    errors.push('Missing document identity');
  if (!document?.modules?.length) errors.push('Document has no modules');

  for (const module of document.modules || []) {
    if (!module.tasks?.length) errors.push(`${module.id}: module has no tasks`);
    for (const task of module.tasks || []) {
      if (!task.questions?.length) errors.push(`${module.id}/${task.id}: task has no questions`);
      if (task.questionRange) {
        const expected = task.questionRange[1] - task.questionRange[0] + 1;
        if (task.questions.length !== expected)
          warnings.push(
            `${module.id}/${task.id}: heading declares ${expected} questions, parsed ${task.questions.length}`
          );
      }
      for (const question of task.questions || []) {
        if (!question.id || questionIds.has(question.id))
          errors.push(`${question.id || task.id}: duplicate or missing question id`);
        questionIds.add(question.id);
        if (!question.type) errors.push(`${question.id}: missing question type`);
        if (['complete-words', 'build-sentence'].includes(question.type) && !question.answer)
          errors.push(`${question.id}: missing answer`);
        if (question.options?.length && question.options.length !== 4)
          warnings.push(`${question.id}: expected 4 options, found ${question.options.length}`);
        if (question.options?.length && !question.answer)
          errors.push(`${question.id}: choice question has no answer`);
      }
    }
  }

  const pageIds = new Set();
  const pagedQuestionIds = [];
  for (const page of document.pages || []) {
    if (!page.id || pageIds.has(page.id))
      errors.push(`${page.id || 'page'}: duplicate or missing page id`);
    pageIds.add(page.id);
    if (!Array.isArray(page.questionIds)) errors.push(`${page.id}: questionIds must be an array`);
    else pagedQuestionIds.push(...page.questionIds);
    if (page.previous && !document.pages.some(item => item.id === page.previous))
      errors.push(`${page.id}: invalid previous`);
    if (page.next && !document.pages.some(item => item.id === page.next))
      errors.push(`${page.id}: invalid next`);
  }
  if (!pageIds.has('start') || !pageIds.has('results'))
    errors.push('Page sequence must contain start and results');
  if (new Set(pagedQuestionIds).size !== pagedQuestionIds.length)
    errors.push('A question is assigned to more than one page');
  for (const questionId of questionIds) {
    if (!pagedQuestionIds.includes(questionId))
      errors.push(`${questionId}: question is not assigned to a page`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidExamDocument(document) {
  const result = validateExamDocument(document);
  if (!result.valid)
    throw new Error(`Invalid ${document?.id || 'exam document'}:\n${result.errors.join('\n')}`);
  return result;
}
