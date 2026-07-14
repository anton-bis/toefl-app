import { createRouter, createWebHashHistory } from 'vue-router';

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

export default router;
