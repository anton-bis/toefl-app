/**
 * Content gating rules for the license feature (license-protocol-v1).
 * Official real exams (date-id tpoIds) require an activated license;
 * practice tests and skills stay free.
 */
export function isOfficialTest(tpoId) {
  return /^\d{4}-\d{2}-\d{2}(?:\s*\(\d+\))?$/.test(String(tpoId || ''));
}
