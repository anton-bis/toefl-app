import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { assertValidExamDocument } from '../../content/validate.js';
import { listCatalog, readText } from '../platform/contentRepository.js';

const parserLoaders = {
  reading: () => import('../../content/parsers/reading.js').then(module => module.parseReading),
  listening: () =>
    import('../../content/parsers/listening.js').then(module => module.parseListening),
  writing: () => import('../../content/parsers/writing.js').then(module => module.parseWriting),
  speaking: () => import('../../content/parsers/speaking.js').then(module => module.parseSpeaking)
};

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    tests: listCatalog(),
    documents: {},
    loading: false,
    error: ''
  }),
  getters: {
    entry: state => (tpoId, section) =>
      state.tests.find(test => test.tpoId === tpoId)?.sections[section]
  },
  actions: {
    async loadDocument(tpoId, section) {
      const cacheKey = `${tpoId}:${section}`;
      if (this.documents[cacheKey]) return this.documents[cacheKey];
      const entry = this.entry(tpoId, section);
      if (!entry) throw new Error(`TPO ${tpoId} 没有 ${section} 题库`);
      this.loading = true;
      this.error = '';
      try {
        const loadParser = parserLoaders[section];
        if (!loadParser) throw new Error(`Unsupported exam section: ${section}`);
        const [markdown, parser] = await Promise.all([readText(entry.documentPath), loadParser()]);
        const document = parser(markdown, {
          tpoId,
          sourcePath: entry.documentPath
        });
        assertValidExamDocument(document);
        this.documents[cacheKey] = markRaw(document);
        const cached = Object.keys(this.documents);
        while (cached.length > 4) delete this.documents[cached.shift()];
        return document;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    invalidate() {
      this.documents = {};
    }
  }
});
