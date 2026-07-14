/** Normalize Markdown before parsing it. */
export function linesOf(markdown) {
  return String(markdown).replace(/\r\n?/g, '\n').split('\n');
}

export function seconds(value) {
  const [minutes, secs] = value.split(':').map(Number);
  return minutes * 60 + secs;
}

export function media(file, start = null, end = null) {
  if (!file) return null;
  return { file, ...(start == null ? {} : { start }), ...(end == null ? {} : { end }) };
}

export function optionsFrom(entries) {
  return entries.map(([label, text]) => ({ id: label, label, text }));
}

export function slug(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sourceMeta(section, options = {}) {
  const tpoId = String(options.tpoId ?? '').padStart(2, '0');
  return {
    id: `tpo-${tpoId}-${section}`,
    tpoId,
    section,
    title: options.title || `${section[0].toUpperCase()}${section.slice(1)} TPO ${tpoId}`,
    sourcePath: options.sourcePath || null
  };
}
