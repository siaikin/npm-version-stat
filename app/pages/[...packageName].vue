<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: t('app.title'),
  description: t('app.description'),
})

const colorMode = useColorMode()
const { locale } = useI18n()

const route = useRoute()

const packageName = ref(
  (Array.isArray(route.params.packageName) ? route.params.packageName : [route.params.packageName]).join(''),
)
watch(packageName, v => navigateTo(`/${encodeURIComponent(v)}`))
</script>

<template>
  <UMain class="space-y-8">
    <UPageHero
      :title="t('app.heroTitle')"
      :description="t('app.description')"
      orientation="horizontal"
    >
      <img
        :src="`/images/hero.${locale}.${colorMode.value}.png`"
        alt="App screenshot"
        class="rounded-lg shadow-2xl ring ring-default"
      >
    </UPageHero>

    <VersionStat v-model:package-name="packageName" />
  </UMain>
</template>
