/**
 * Build the route-independent page sequence consumed by the Vue exam flow.
 * Page IDs are stable within a document and deliberately contain no .html names.
 */
export function createExamPages(document) {
  const pages = [{ id: 'start', type: 'start', section: document.section, questionIds: [] }];

  for (const module of document.modules) {
    if (!['writing', 'speaking'].includes(document.section)) {
      pages.push({ id: `${module.id}-intro`, type: 'intro', moduleId: module.id, questionIds: [] });
    }
    for (const task of module.tasks) {
      if (['writing', 'speaking'].includes(document.section)) {
        pages.push({
          id: `${task.id}-intro`,
          type: 'intro',
          moduleId: module.id,
          taskId: task.id,
          questionIds: []
        });
      }
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

      const hasListeningStimulus = ['conversation', 'announcement', 'academic-talk'].includes(
        task.type
      );
      if (document.section === 'listening' && hasListeningStimulus) {
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

      if (document.section === 'reading' && task.type === 'complete-words') {
        pages.push({
          id: `${module.id}-${task.id}`,
          type: 'question',
          moduleId: module.id,
          taskId: task.id,
          questionType: task.type,
          questionIds: task.questions.map(question => question.id)
        });
        continue;
      }

      for (const question of task.questions) {
        pages.push({
          id: question.id,
          type: 'question',
          moduleId: module.id,
          taskId: task.id,
          questionType: question.type,
          questionIds: [question.id]
        });
      }
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
