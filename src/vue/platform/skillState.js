import { reactive } from 'vue';

/**
 * Return state for the skills workspaces (typing / vocabulary). Each entry
 * remembers the last page, window scroll offset and (for vocabulary) subject so
 * that leaving a skill and coming back restores the page the user was on, at
 * the same position.
 */
export const skillState = reactive({
  typing: { page: '', scrollTop: 0 },
  vocabulary: { page: '', scrollTop: 0, subject: '' }
});

export function currentWindowScroll() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || window.pageYOffset || 0;
}

export function restoreWindowScroll(top) {
  const value = top || 0;
  if (typeof document !== 'undefined') {
    const root = document.scrollingElement || document.documentElement;
    if (root) {
      root.scrollTop = value;
      return;
    }
  }
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try {
      window.scrollTo(0, value);
    } catch {
      // jsdom and other environments may not implement scrolling.
    }
  }
}
