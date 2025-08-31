<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import * as locales from '@nuxt/ui/locale'

const { ui } = useAppConfig()
const colorMode = useColorMode()
watch(
  colorMode,
  () => {
    switch (colorMode.value) {
      case 'light':
        ui.colors.primary = 'red'
        break
      case 'dark':
        ui.colors.primary = 'zincgray'
        break
      default:
    }
  },
  { immediate: true },
)

const { locale } = useI18n()

const uiLocale = ref(locales.en)

watch(locale, (_locale) => {
  switch (_locale) {
    case 'zh-CN':
      uiLocale.value = locales.zh_cn
      break
    case 'en':
      uiLocale.value = locales.en
      break
    default:
  }
}, { immediate: true })

const lang = computed(() => uiLocale.value.code)
const dir = computed(() => uiLocale.value.dir)

useHead({
  htmlAttrs: {
    lang,
    dir,
  },
})
</script>

<template>
  <Analytics />
  <UApp :locale="uiLocale">
    <LayoutHeader />

    <NuxtPage />

    <!-- <LayoutFooter /> -->
  </UApp>
</template>
