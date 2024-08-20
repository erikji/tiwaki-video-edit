import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import ShuffleView from './views/ShuffleView.vue'
import TrimView from './views/TrimView.vue'

const app = createApp(App)

app.use(createPinia())

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      {
        path: '/',
        name: 'home',
        component: HomeView
      },
      {
        path: '/shuffle',
        name: 'shuffle',
        component: ShuffleView
      },
      {
        path: '/trim',
        name: 'trim',
        component: TrimView
      },
      {
        path: '/login',
        name: 'login',
        component: () => import('@/views/LoginView.vue')
      }
    ]
  })

app.use(router)

app.mount('#app')
