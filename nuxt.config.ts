import Aura from '@primevue/themes/aura';
import tailwindcss from "@tailwindcss/vite";



// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  css: [
    '~/assets/css/tailwind.css',
    'primeicons/primeicons.css',
    '~/assets/css/main.css',
  ],


  runtimeConfig: {
    apiKey: 'hello',
    llm: {
      baseURL: '',
      apiKey: '',
      provider: '',
      model: ''
    },
    public: {

    }
  },

  app: {
    head: {
      title: 'EasyTable',
    },
    baseURL: '/easy-table/'
  },

  modules: [
    '@primevue/nuxt-module',
  ],

  vite: {
    plugins: [
      tailwindcss()
    ]
  },

  primevue: {
    options: {
      theme: {
        preset: Aura
      }
    }
  },

  // tailwindcss: {
  //   cssPath: ['~/assets/css/tailwind.css', { injectPosition: 'first' }],
  //   config: {
  //     plugins: [
  //       require('tailwindcss-primeui')
  //     ],
  //   },
  //   viewer: true,

  // }
})
