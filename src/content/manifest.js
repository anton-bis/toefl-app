const SECTIONS = ['reading', 'listening', 'writing', 'speaking'];

/**
 * Convert discovered question paths into a deterministic catalog.
 * This function is environment-independent; the CLI owns filesystem traversal.
 */
export function buildQuestionManifest(paths) {
  const warnings = [];
  const entries = [];

  for (const input of paths) {
    const path = String(input).replace(/\\/g, '/');
    const match = path.match(
      /(?:^|\/)assets\/questions\/(reading|listening|writing|speaking)\/TPO-(\d+)\/([^/]+\.md)$/i
    );
    if (!match) continue;
    const section = match[1].toLowerCase();
    const tpoId = match[2].padStart(2, '0');
    const expected = `${section}-TPO-${tpoId}.md`.toLowerCase();
    if (match[3].toLowerCase() !== expected) {
      warnings.push(`${path}: expected filename ${section}-TPO-${tpoId}.md`);
    }
    entries.push({
      id: `tpo-${tpoId}-${section}`,
      tpoId,
      section,
      sourcePath: path.slice(path.indexOf('assets/questions/')),
      documentPath: `assets/questions/compiled/tpo-${tpoId}-${section}.json`
    });
  }

  entries.sort(
    (a, b) =>
      Number(a.tpoId) - Number(b.tpoId) || SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section)
  );
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error(`Duplicate question document: ${entry.id}`);
    seen.add(entry.id);
  }

  const tpos = [...new Set(entries.map(entry => entry.tpoId))].map(tpoId => ({
    id: tpoId,
    sections: Object.fromEntries(
      entries
        .filter(entry => entry.tpoId === tpoId)
        .map(entry => [entry.section, entry.documentPath])
    )
  }));
  return {
    generatedAt: null,
    entries,
    tpos,
    warnings
  };
}

export { SECTIONS };
