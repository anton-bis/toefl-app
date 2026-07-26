import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import {
  listCatalog,
  readCatalogManifest,
  readQuestionDocument
} from '../platform/contentRepository.js';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    tests: [],
    documents: {},
    catalogLoaded: false,
    loading: false,
    error: ''
  }),
  getters: {
    entry: state => (tpoId, section) =>
      state.tests.find(test => test.tpoId === tpoId)?.sections[section]
  },
  actions: {
    async refreshCatalog() {
      const catalog = await readCatalogManifest();
      this.tests = listCatalog(catalog);
      this.catalogLoaded = true;
    },
    async loadDocument(tpoId, section) {
      const cacheKey = `${tpoId}:${section}`;
      if (this.documents[cacheKey]) return this.documents[cacheKey];
      this.loading = true;
      this.error = '';
      try {
        if (!this.catalogLoaded) await this.refreshCatalog();
        const entry = this.entry(tpoId, section);
        if (!entry) throw new Error(`No ${section} content is available for TPO ${tpoId}.`);
        const document = await readQuestionDocument(entry);
        this.documents[cacheKey] = markRaw(document);
        const cached = Object.keys(this.documents);
        while (cached.length > 2) delete this.documents[cached.shift()];
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
      this.catalogLoaded = false;
    }
  }
});
