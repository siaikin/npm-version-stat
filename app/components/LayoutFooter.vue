<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UFooter>
    <template #left>
      <p class="text-muted text-sm">
        © {{ new Date().getFullYear() }} {{ t('footer.copyright') }} -
        <ULink to="https://api.npmjs.org" target="_blank" class="text-primary">
          {{ t('footer.dataSource') }}
        </ULink>
      </p>
    </template>

    <template #right>
      <UButton
        icon="i-simple-icons-github"
        color="neutral"
        variant="ghost"
        to="https://github.com/siaikin/npm-version-stat"
        target="_blank"
        aria-label="GitHub"
      />
      <UButton
        icon="i-lucide-external-link"
        color="neutral"
        variant="ghost"
        to="https://www.npmjs.com"
        target="_blank"
        :aria-label="t('footer.npmOfficial')"
      />
    </template>
  </UFooter>
</template>
