import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { CONTENT_SCHEMA_VERSION } from '../../../electron/services/runtime-content.js';
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
    error: '',
    contentManifestId: '',
    catalogContentHash: ''
  }),
  getters: {
    entry: state => (tpoId, section) =>
      state.tests.find(test => test.tpoId === tpoId)?.sections[section],
    contentIdentity: state => (tpoId, section, documentKey = '') => {
      const entry = state.tests.find(test => test.tpoId === tpoId)?.sections[section];
      return {
        documentKey: documentKey || `tpo-${tpoId}-${section}`,
        documentHash: entry?.documentHash || '',
        contentManifestId: state.contentManifestId || state.catalogContentHash,
        contentSchemaVersion: CONTENT_SCHEMA_VERSION
      };
    }
  },
  actions: {
    async refreshContentDescriptor() {
      const api = window.electronAPI;
      if (!api?.getContentDescriptor) return;
      try {
        const descriptor = await api.getContentDescriptor();
        if (descriptor?.manifestId) this.contentManifestId = descriptor.manifestId;
      } catch {
        // The descriptor is best effort; the catalog hash remains the fallback.
      }
    },
    async refreshCatalog() {
      const catalog = await readCatalogManifest();
      this.tests = listCatalog(catalog);
      this.catalogContentHash = catalog.contentHash || '';
      this.catalogLoaded = true;
      await this.refreshContentDescriptor();
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
