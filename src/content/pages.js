/**
 * Build the route-independent page sequence consumed by the Vue exam flow.
 * Page IDs are stable within a document and deliberately contain no .html names.
 */
function taskIntroPage(section, module, task) {
  if (!['writing', 'speaking'].includes(section)) return null;
  return {
    id: `${task.id}-intro`,
    type: 'intro',
    moduleId: module.id,
    taskId: task.id,
    questionIds: []
  };
}

function taskContextPages(section, module, task) {
  const pages = [];
  if (task.scenario) {
    pages.push({
      id: `${module.id}-${task.id}-scenario`,
      type: 'scenario',
      moduleId: module.id,
      taskId: task.id,
      scenario: task.scenario,
      questionIds: []
    });
  }
  const hasStimulus = ['conversation', 'announcement', 'academic-talk'].includes(task.type);
  if (section === 'listening' && hasStimulus) {
    pages.push({
      id: `${module.id}-${task.id}-stimulus`,
      type: 'stimulus',
      moduleId: module.id,
      taskId: task.id,
      media: task.media,
      transcript: task.transcript,
      questionIds: []
    });
  }
  return pages;
}

function taskQuestionPages(section, module, task) {
  if (section === 'reading' && task.type === 'complete-words') {
    return [
      {
        id: `${module.id}-${task.id}`,
        type: 'question',
        moduleId: module.id,
        taskId: task.id,
        questionType: task.type,
        questionIds: task.questions.map(question => question.id)
      }
    ];
  }
  return task.questions.map(question => ({
    id: question.id,
    type: 'question',
    moduleId: module.id,
    taskId: task.id,
    questionType: question.type,
    questionIds: [question.id]
  }));
}

function createExamPages(document) {
  const pages = [{ id: 'start', type: 'start', section: document.section, questionIds: [] }];

  for (const module of document.modules) {
    if (!['writing', 'speaking'].includes(document.section)) {
      pages.push({ id: `${module.id}-intro`, type: 'intro', moduleId: module.id, questionIds: [] });
    }
    for (const task of module.tasks) {
      const intro = taskIntroPage(document.section, module, task);
      if (intro) pages.push(intro);
      pages.push(...taskContextPages(document.section, module, task));
      pages.push(...taskQuestionPages(document.section, module, task));
    }
  }

  pages.push({ id: 'results', type: 'results', section: document.section, questionIds: [] });
  return pages.map((page, index) => ({
    ...page,
    index,
    previous: index ? pages[index - 1].id : null,
    next: index < pages.length - 1 ? pages[index + 1].id : null
  }));
}

export function createExamDocument(meta, modules) {
  const document = { ...meta, modules };
  return { ...document, pages: createExamPages(document) };
}
