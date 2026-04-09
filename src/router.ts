import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/editor',
      component: () => import('./views/EditorView.vue'),
    },
    {
      path: '/presets',
      component: () => import('./views/PresetsView.vue'),
    },
    {
      path: '/batch',
      component: () => import('./views/BatchView.vue'),
    },
  ],
})

export default router
