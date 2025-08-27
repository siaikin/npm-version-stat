<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: t('app.title'),
  description: t('app.description'),
})

const route = useRoute()

const packageName = ref(((route.params.packageName ?? []) as string[]).join(''))
watch(packageName, v => navigateTo(`/${encodeURIComponent(v)}`))
</script>

<template>
  <UMain class="space-y-8">
    <UPageHero
      :title="t('app.heroTitle')"
      :description="t('app.description')"
    />

    <VersionStat v-model:package-name="packageName" />
  </UMain>
</template>
