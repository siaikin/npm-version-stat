<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()

const availableLocales = computed(() => {
  return locales.value.map(l => ({
    code: l.code,
    name: l.name,
  }))
})
</script>

<template>
  <UHeader :toggle="false">
    <template #title>
      <ULink to="/" class="flex items-center gap-2 text-xl font-bold">
        <UIcon name="i-lucide-package" class="text-primary" />
        {{ t('header.title') }}
      </ULink>
    </template>

    <template #right>
      <!-- 语言切换器 -->
      <UDropdownMenu
        :items="[availableLocales.map(lang => ({
          label: `${lang.name}`,
          type: 'checkbox',
          checked: lang.code === locale,
          onSelect: () => setLocale(lang.code),
        }))]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-globe"
        />
      </UDropdownMenu>

      <UColorModeSelect />
    </template>
  </UHeader>
</template>
