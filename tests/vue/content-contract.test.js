import { describe, expect, it } from 'vitest';
import {
  expirationCopy,
  helpCopy,
  introDirections,
  readyPrompt,
  startDirections
} from '../../src/vue/exam/shared/directions.js';
import { cefrRows, scoreConversionRows, taskTypes } from '../../src/vue/content/guideCopy.js';

describe('visible content contract', () => {
  it('keeps section directions and task-specific help', () => {
    expect(startDirections('listening').description).toContain('35 - 45 questions');
    expect(startDirections('listening').tasks[0][1]).toBe(
      'Select the best response to the questions or statement.'
    );
    const listeningIntro = [
      'The first task is Listen and Choose a Response. In this task, you will listen to a',
      'sentence or question. You will then read four sentences and choose the option that is',
      'the best response.'
    ].join(' ');
    expect(introDirections('listening', { moduleId: 'module-1' }, {})).toContain(listeningIntro);
    expect(introDirections('speaking', {}, { type: 'interview' })[0]).toContain(
      'be sure to speak as much as you can'
    );
    expect(helpCopy('listening', { type: 'stimulus' }, {})).toContain('Audio starts automatically');
    expect(helpCopy('reading', { type: 'question' }, { type: 'text-chain' })).toContain(
      'Read the text chain conversation on the left'
    );
    expect(helpCopy('writing', { type: 'question' }, { type: 'write-email' })).toContain(
      'Click Hide Word Count to toggle visibility.'
    );
    expect(helpCopy('speaking', { type: 'scenario' }, {})).toContain(
      'the section title is announced once'
    );
  });

  it('keeps task-specific Ready and expiration actions', () => {
    expect(readyPrompt('reading', { moduleId: 'module-2' }, {})).toBe(
      'Are you ready to begin Module 2?\nOnce you start, you cannot return to this introduction.'
    );
    expect(readyPrompt('speaking', {}, { type: 'interview' })).toContain(
      'the Take an Interview task'
    );
    expect(expirationCopy('reading').finish).toBe('Score and Exit');
    expect(expirationCopy('writing').body).toContain('continue working without time limit');
  });

  it('provides complete structured home information', () => {
    expect(taskTypes.flatMap(([, items]) => items)).toHaveLength(12);
    expect(cefrRows).toHaveLength(6);
    expect(scoreConversionRows.at(-1)).toEqual(['1', '1–1.5', '0–1', '0–2', '0–4', '0–11']);
    expect(JSON.stringify({ taskTypes, cefrRows, scoreConversionRows })).not.toMatch(
      /[\u3400-\u9fff]/u
    );
  });
});
