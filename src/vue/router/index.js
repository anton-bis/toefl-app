import { createRouter, createWebHashHistory } from 'vue-router';
import { isOfficialTest } from '../platform/licenseRules.js';
import { useLicenseStore } from '../stores/license.js';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/exam/:tpoId/:section/:pageId?',
      name: 'exam',
      component: () => import('../views/ExamView.vue'),
      props: true
    },
    {
      path: '/skills/typing',
      name: 'typing',
      component: () => import('../views/TypingView.vue')
    },
    {
      path: '/skills/vocabulary',
      name: 'vocabulary',
      component: () => import('../views/VocabularyView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
});

// Official real exams require an activated license. Practice tests and skills
// stay free. Browser mode ('unavailable') never locks content.
router.beforeEach(async to => {
  const match = String(to.path).match(/^\/exam\/([^/]+)\//);
  if (!match || !isOfficialTest(decodeURIComponent(match[1]))) return true;

  let license;
  try {
    license = useLicenseStore();
  } catch {
    return true;
  }
  if (!license.ready) await license.refresh().catch(() => {});
  if (license.contentLocked) return { name: 'home', query: { ...to.query, activate: '1' } };
  return true;
});

export default router;
