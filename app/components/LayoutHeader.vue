<script setup lang="ts">
const { t, locale, localeProperties, locales, setLocale } = useI18n()

const availableLocales = computed(() => {
  return locales.value.map(l => ({
    code: l.code,
    name: l.name,
  }))
})
</script>

<template>
  <UHeader mode="slideover" :ui="{ title: 'items-center' }">
    <template #title>
      <UIcon name="i-lucide-package" class="text-primary" />
      {{ t('header.title') }}
    </template>

    <template #right>
      <!-- 语言切换器 -->
      <UDropdownMenu
        class="max-lg:hidden"
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

      <UColorModeSelect
        class="max-lg:hidden"
      />
    </template>

    <template #body>
      <div class="flex gap-2">
        <USelectMenu
          :model-value="locale"
          :search-input="false"
          value-key="value"
          icon="i-lucide-globe"
          :items="availableLocales.map(lang => ({
            label: `${lang.name}`,
            value: lang.code,
          }))"
          @update:model-value="setLocale"
        />

        <USeparator orientation="vertical" class="h-auto" />

        <UColorModeSelect />
      </div>
    </template>
  </UHeader>
</template>
