import { describe, expect, it } from 'vitest';
import { formatHoursMinutesSeconds, formatMinutesSeconds } from '../../src/vue/utils/time.js';
import { normalizeVolume } from '../../src/vue/utils/volume.js';
import { isPlainObject } from '../../src/vue/platform/localPersistence.js';

describe('shared UI utilities', () => {
  it('formats non-negative minute and hour clocks consistently', () => {
    expect(formatMinutesSeconds(70)).toBe('01:10');
    expect(formatMinutesSeconds(3_670)).toBe('61:10');
    expect(formatHoursMinutesSeconds(3_670)).toBe('01:01:10');
  });

  it('normalizes fractional, invalid and negative time values', () => {
    expect(formatMinutesSeconds(1.9)).toBe('00:01');
    expect(formatMinutesSeconds(-1)).toBe('00:00');
    expect(formatHoursMinutesSeconds(Number.NaN)).toBe('00:00:00');
  });

  it('normalizes media volume to the HTML media element range', () => {
    expect(normalizeVolume(0.4)).toBe(0.4);
    expect(normalizeVolume(2)).toBe(1);
    expect(normalizeVolume(-1)).toBe(0);
    expect(normalizeVolume('invalid')).toBe(0.8);
  });

  it('distinguishes record-like values from arrays and primitives', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });
});
