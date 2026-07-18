function validateIdentity(document, errors) {
  if (!document?.id || !document?.tpoId || !document?.section) {
    errors.push('Missing document identity');
  }
  if (!document?.modules?.length) errors.push('Document has no modules');
}

function validateChoiceQuestion(question, errors, warnings) {
  if (!question.options?.length) return;
  if (question.options.length !== 4) {
    warnings.push(`${question.id}: expected 4 options, found ${question.options.length}`);
  }
  if (!question.answer) errors.push(`${question.id}: choice question has no answer`);
}

function validateQuestion(question, task, questionIds, errors, warnings) {
  if (!question.id || questionIds.has(question.id)) {
    errors.push(`${question.id || task.id}: duplicate or missing question id`);
  }
  questionIds.add(question.id);
  if (!question.type) errors.push(`${question.id}: missing question type`);
  if (['complete-words', 'build-sentence'].includes(question.type) && !question.answer) {
    errors.push(`${question.id}: missing answer`);
  }
  validateChoiceQuestion(question, errors, warnings);
}

function validateQuestionRange(module, task, warnings) {
  if (!task.questionRange) return;
  const expected = task.questionRange[1] - task.questionRange[0] + 1;
  if (task.questions.length !== expected) {
    warnings.push(
      `${module.id}/${task.id}: heading declares ${expected} questions, parsed ${task.questions.length}`
    );
  }
}

function validateTasks(document, errors, warnings) {
  const questionIds = new Set();
  for (const module of document.modules || []) {
    if (!module.tasks?.length) errors.push(`${module.id}: module has no tasks`);
    for (const task of module.tasks || []) {
      if (!task.questions?.length) errors.push(`${module.id}/${task.id}: task has no questions`);
      validateQuestionRange(module, task, warnings);
      for (const question of task.questions || []) {
        validateQuestion(question, task, questionIds, errors, warnings);
      }
    }
  }
  return questionIds;
}

function collectPageQuestions(page, pagedQuestionIds, errors) {
  if (!Array.isArray(page.questionIds)) {
    errors.push(`${page.id}: questionIds must be an array`);
    return;
  }
  pagedQuestionIds.push(...page.questionIds);
}

function validatePageLinks(page, pageIds, errors) {
  if (page.previous && !pageIds.has(page.previous)) errors.push(`${page.id}: invalid previous`);
  if (page.next && !pageIds.has(page.next)) errors.push(`${page.id}: invalid next`);
}

function validatePageCoverage(pageIds, pagedQuestionIds, questionIds, errors) {
  if (!pageIds.has('start') || !pageIds.has('results')) {
    errors.push('Page sequence must contain start and results');
  }
  if (new Set(pagedQuestionIds).size !== pagedQuestionIds.length) {
    errors.push('A question is assigned to more than one page');
  }
  const assignedQuestions = new Set(pagedQuestionIds);
  for (const questionId of questionIds) {
    if (!assignedQuestions.has(questionId)) {
      errors.push(`${questionId}: question is not assigned to a page`);
    }
  }
}

function validatePages(document, questionIds, errors) {
  const pages = document.pages || [];
  const pageIds = new Set();
  const pagedQuestionIds = [];
  for (const page of pages) {
    if (!page.id || pageIds.has(page.id)) {
      errors.push(`${page.id || 'page'}: duplicate or missing page id`);
    }
    pageIds.add(page.id);
    collectPageQuestions(page, pagedQuestionIds, errors);
  }
  for (const page of pages) validatePageLinks(page, pageIds, errors);
  validatePageCoverage(pageIds, pagedQuestionIds, questionIds, errors);
}

/** Validate an ExamDocument without coupling validation to rendering. */
export function validateExamDocument(document) {
  const errors = [];
  const warnings = [];
  validateIdentity(document, errors);
  const questionIds = validateTasks(document || {}, errors, warnings);
  validatePages(document || {}, questionIds, errors);
  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidExamDocument(document) {
  const result = validateExamDocument(document);
  if (!result.valid) {
    throw new Error(`Invalid ${document?.id || 'exam document'}:\n${result.errors.join('\n')}`);
  }
  return result;
}
