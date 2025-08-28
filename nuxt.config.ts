// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n', '@nuxt/image'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  eslint: {
    config: {
      standalone: false,
      stylistic: true,
    },
  },
  fonts: {
    provider: 'bunny',
  },
  i18n: {
    strategy: 'no_prefix',
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh_CN.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'en',
    vueI18n: './i18n/i18n.config.ts',
  },
})