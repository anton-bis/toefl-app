import { parseListening } from './listening.js';
import { parseReading } from './reading.js';
import { parseSpeaking } from './speaking.js';
import { parseWriting } from './writing.js';

const parsers = {
  reading: parseReading,
  listening: parseListening,
  writing: parseWriting,
  speaking: parseSpeaking
};

export function parseExamDocument(section, markdown, options = {}) {
  const parser = parsers[section];
  if (!parser) throw new Error(`Unsupported exam section: ${section}`);
  return parser(markdown, options);
}
