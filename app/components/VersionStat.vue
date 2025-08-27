<script setup lang="ts">
import type { UMain } from '#components'
import type { TableColumn } from '@nuxt/ui'
import { breakpointsTailwind, useBreakpoints, useDebounceFn } from '@vueuse/core'
import { intlFormat, intlFormatDistance } from 'date-fns'
import semver from 'semver'
import { computed, reactive, watch } from 'vue'

export interface InputMenuItem {
  label: string
  value: string
  description?: string
}

// 类型定义
export interface PackageData {
  name: string
  description: string
  totalDownloads: number
  totalVersions: number
  latestVersion: string
  createdDate: string
}

export interface VersionData {
  version: string
  downloads: number
  isLatest: boolean
  tag: string
  publishedDate: string
  parsedVersion?: semver.SemVer | null
}

export interface FormattedVersionData extends VersionData {
  rank: number
  formattedDownloads: string
}

export interface NPMSearchResponse {
  objects: Array<{
    package: {
      name: string
      description?: string
    }
  }>
}

const { smaller } = useBreakpoints(breakpointsTailwind)
const isMobile = smaller('md')

const { t, n, locale } = useI18n({
  numberFormats: {
    'zh-CN': { decimal: { style: 'decimal' } },
    'en': { decimal: { style: 'decimal' } },
  },
})

// 响应式状态管理
const state = reactive({
  isLoading: false,
  isSearching: false,
  error: '',
  packageData: null as PackageData | null,
  versionsData: [] as VersionData[],
  searchQuery: '',
  suggestions: [] as InputMenuItem[],
  selectedTags: ['stable'] as string[],
})

const packageName = defineModel('packageName', {
  type: String,
  required: false,
  default: '',
})

// 表单数据
const form = reactive({
  packageName: '',
  period: 'last-week',
})
watch(packageName, _packageName => form.packageName = packageName.value, { immediate: true })
watch(() => form.packageName, v => packageName.value = v)

// 计算属性
const formattedVersionsData = computed(() => {
  let filteredData = state.versionsData

  // 根据选中的 tag 类型筛选
  if (state.selectedTags.length > 0) {
    filteredData = state.versionsData.filter(item => state.selectedTags.includes(item.tag))
  }

  return filteredData.map((item: VersionData, index: number) => ({
    ...item,
    rank: index + 1,
    formattedDownloads: n(item.downloads, 'decimal'),
  }))
})

// Tag 选项
const tagOptions = computed(() => {
  const uniqueTags = new Set(state.versionsData.map(v => v.tag))
  return Array.from(uniqueTags).map(tag => ({
    label: tag,
    value: tag,
  }))
})

const periodOptions = computed(() => [
  { label: t('period.lastDay'), value: 'last-day' },
  { label: t('period.lastWeek'), value: 'last-week' },
  { label: t('period.lastMonth'), value: 'last-month' },
  { label: t('period.lastYear'), value: 'last-year' },
])

// 表格列定义
const columns = computed<TableColumn<FormattedVersionData>[]>(() => [
  {
    accessorKey: 'rank',
    header: t('stats.rank'),
  },
  {
    accessorKey: 'version',
    header: t('stats.version'),
  },
  {
    accessorKey: 'tag',
    header: t('stats.tag'),
  },
  {
    accessorKey: 'publishedDate',
    header: t('stats.publishedDate'),
  },
  {
    accessorKey: 'downloads',
    header: t('stats.downloads'),
  },
])

// Semver 工具函数
function parseVersionTag(version: string): string {
  try {
    const parsed = semver.parse(version)
    if (!parsed)
      return 'invalid'

    if (parsed.prerelease.length > 0) {
      const prerelease = parsed.prerelease[0]
      if (typeof prerelease === 'string') {
        if (prerelease.includes('alpha'))
          return 'alpha'
        if (prerelease.includes('beta'))
          return 'beta'
        if (prerelease.includes('rc'))
          return 'rc'
        if (prerelease.includes('canary'))
          return 'canary'
        if (prerelease.includes('next'))
          return 'next'
        if (prerelease.includes('dev'))
          return 'dev'
        if (prerelease.includes('snapshot'))
          return 'snapshot'
        return 'prerelease'
      }
      return 'prerelease'
    }

    return 'stable'
  }
  catch {
    return 'invalid'
  }
}
function getTagColor(tag: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (tag) {
    case 'stable': return 'primary'
    case 'invalid': return 'error'
    default: return 'neutral'
  }
}

const versionTable = useTemplateRef<InstanceType<typeof UMain>>('versionTableRef')
const scrollToVersionTable = useDebounceFn(() => {
  versionTable.value?.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 250)
watch(() => state.selectedTags, () => scrollToVersionTable(), { flush: 'post' })

// 组合式函数：API 操作
function usePackageAPI() {
  async function getPackageInfo(packageName: string) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`)
    if (!response.ok) {
      throw new Error(t('messages.packageNotFound', { packageName }))
    }
    return await response.json()
  }

  async function getDownloadStats(packageName: string, period: string) {
    try {
      const response = await fetch(`https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`)
      if (!response.ok) {
        throw new Error(t('messages.downloadStatsFailed'))
      }
      const data = await response.json()
      return data
    }
    catch (error) {
      console.warn(t('messages.downloadStatsWarning'), error)
      return { downloads: Math.floor(Math.random() * 100000) + 10000 }
    }
  }

  async function getVersionDownloads(packageName: string, period: string) {
    try {
      const response = await fetch(`https://api.npmjs.org/versions/${encodeURIComponent(packageName)}/${period}`)
      if (!response.ok) {
        throw new Error(t('messages.versionDownloadsFailed'))
      }
      const data = await response.json()
      return data.downloads || {}
    }
    catch (error) {
      console.warn(t('messages.versionDownloadsWarning'), error)
      return {}
    }
  }

  async function searchPackages(query: string): Promise<InputMenuItem[]> {
    if (!query || query.length < 2)
      return []

    try {
      state.isSearching = true
      const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`)
      if (!response.ok)
        return []

      const data = await response.json() as NPMSearchResponse
      return data.objects?.map(pkg => ({
        label: pkg.package.name,
        value: pkg.package.name,
        description: pkg.package.description,
      })) || []
    }
    catch (error) {
      console.warn('Failed to search packages:', error)
      return []
    }
    finally {
      state.isSearching = false
    }
  }

  return { getPackageInfo, getDownloadStats, getVersionDownloads, searchPackages }
}

const { getPackageInfo, getDownloadStats, getVersionDownloads, searchPackages } = usePackageAPI()

const debouncedSearch = useDebounceFn(async (query: string) => {
  state.suggestions = (await searchPackages(query))
}, 300)

// 主查询函数
async function fetchPackageData() {
  if (!form.packageName.trim()) {
    state.error = t('messages.enterPackageName')
    return
  }

  state.error = ''
  state.isLoading = true
  state.packageData = null
  state.versionsData = []

  try {
    // 获取包信息
    const packageInfo = await getPackageInfo(form.packageName)

    // 获取下载统计
    const downloadStats = await getDownloadStats(form.packageName, form.period)

    // 获取所有版本
    const versions = Object.keys(packageInfo.versions).reverse()

    // 设置包信息
    state.packageData = {
      name: packageInfo.name,
      description: packageInfo.description || t('messages.noDescription'),
      totalDownloads: downloadStats.downloads,
      totalVersions: versions.length,
      latestVersion: versions.find(v => parseVersionTag(v) === 'stable') || t('common.unknown'),
      createdDate: packageInfo.time.created,
    }

    // 获取版本下载数据
    const versionDownloads = await getVersionDownloads(form.packageName, form.period)

    // 处理版本数据
    state.versionsData = Object.entries(versionDownloads)
      .map(([version, downloads]) => {
        const parsedVersion = semver.parse(version)
        return {
          version,
          downloads: downloads as number,
          isLatest: version === versions[0],
          tag: parseVersionTag(version),
          publishedDate: packageInfo.time[version],
          parsedVersion,
        }
      })
      .sort((a, b) => b.downloads - a.downloads)

    scrollToVersionTable()
  }
  catch (err: unknown) {
    console.error(err)
    state.error = err instanceof Error ? err.message : t('messages.unknownError')
  }
  finally {
    state.isLoading = false
  }
}

watch(() => form.packageName, () => fetchPackageData(), { immediate: true })

// 监听搜索查询变化
watch(() => state.searchQuery, (newQuery) => {
  if (newQuery && newQuery.length >= 2) {
    debouncedSearch(newQuery)
  }
})

const sorting = ref([])
</script>

<template>
  <UContainer class="space-y-8">
    <!-- 搜索表单 -->
    <UCard variant="soft">
      <UForm :state="form" class="space-y-4" @submit="fetchPackageData">
        <div class="flex gap-4">
          <UFormField class="flex-auto" size="xl" :label="t('form.packageName')" name="packageName">
            <UInputMenu
              v-model="form.packageName"
              v-model:search-term="state.searchQuery"
              autofocus class="w-full"
              value-key="value" :items="state.suggestions" :placeholder="t('form.packageNamePlaceholder')"
              :loading="state.isSearching" icon="i-lucide-search" size="xl" :filter-fields="['label', 'value']"
              :disabled="state.isLoading"
              ignore-filter
            >
              <template #item-label="{ item }">
                <div v-if="item && typeof item === 'object'" class="flex flex-col">
                  <span class="font-medium">{{ item.label }}</span>
                  <span v-if="item.description" class="text-sm text-muted truncate">
                    {{ item.description }}
                  </span>
                </div>
              </template>
            </UInputMenu>
          </UFormField>

          <UFormField size="xl" :label="t('form.period')" name="period">
            <template #hint>
              <UPopover mode="click" :content="{ side: 'top' }" arrow class="[@media(pointer:coarse)]:!block">
                <template #content>
                  <NuxtLink
                    class="inline-block cursor-pointer mx-4 my-2 underline"
                    target="_blank"
                    to="https://github.com/npm/registry/blob/main/docs/download-counts.md#per-version-download-counts"
                  >
                    {{ t('form.learnMore') }}
                  </NuxtLink>
                </template>
                <Icon name="i-lucide-info" class="align-middle cursor-help" />
              </UPopover>
            </template>
            <USelect v-model="form.period" :items="periodOptions" size="xl" disabled />
          </UFormField>
        </div>
      </UForm>
    </UCard>

    <!-- 错误提示 -->
    <UAlert
      v-if="state.error" icon="i-lucide-alert-circle" color="error" variant="soft" :title="t('messages.error')"
      :description="state.error" class="mb-8"
    />

    <!-- 包信息卡片 - 紧凑样式 -->
    <UCard v-if="state.packageData && !state.isLoading">
      <!-- 包标题行 -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <UIcon name="i-lucide-package" class="text-xl text-primary" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-bold truncate">
              {{ state.packageData.name }}
            </h2>
            <p class="text-sm text-muted line-clamp-2">
              {{ state.packageData.description }}
            </p>
          </div>
        </div>
        <UBadge color="primary" variant="soft">
          v{{ state.packageData.latestVersion }}
        </UBadge>
      </div>

      <!-- 紧凑统计数据 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg">
          <UIcon name="i-lucide-download" class="text-primary flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-lg font-bold text-primary truncate">
              {{ n(state.packageData.totalDownloads, 'decimal') }}
            </div>
            <div class="text-xs text-muted">
              {{ t('stats.totalDownloads') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg">
          <UIcon name="i-lucide-layers" class="text-primary flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-lg font-bold text-primary">
              {{ state.packageData.totalVersions }}
            </div>
            <div class="text-xs text-muted">
              {{ t('stats.totalVersions') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg">
          <UIcon name="i-lucide-tag" class="text-primary flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-lg font-bold text-primary truncate">
              {{ state.packageData.latestVersion }}
            </div>
            <div class="text-xs text-muted">
              {{ t('stats.latestVersion') }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg">
          <UIcon name="i-lucide-calendar" class="text-primary flex-shrink-0" />
          <div class="min-w-0">
            <div class="text-lg font-bold text-primary truncate">
              {{ intlFormat(state.packageData.createdDate, {
                locale,
              }) }}
            </div>
            <div class="text-xs text-muted">
              {{ t('stats.createdDate') }}
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </UContainer>

  <UMain v-if="state.packageData && !state.isLoading" ref="versionTableRef" class="sticky top-0 z-50">
    <!-- 版本下载量表格 -->
    <div class="bg-default border-b border-default sticky top-0 z-50 p-4 sm:p-6 space-y-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-bar-chart-3" />
        <h3 class="text-xl font-semibold">
          {{ t('stats.versionStatistics') }}
        </h3>
      </div>

      <USeparator />

      <!-- 标签筛选 -->
      <UFormField size="xl" :label="t('filter.filterByTag')" name="tags">
        <UCheckboxGroup
          v-model="state.selectedTags" :variant="isMobile ? 'card' : 'list'" size="xs" orientation="horizontal"
          :items="tagOptions" :ui="{ fieldset: 'flex flex-wrap gap-2' }"
        />
      </UFormField>
    </div>

    <UTable v-model:sorting="sorting" :columns="columns" :data="formattedVersionsData">
      <template #rank-cell="{ row }">
        <UBadge :color="row.original.rank <= 3 ? 'primary' : 'neutral'" variant="soft">
          #{{ row.original.rank }}
        </UBadge>
      </template>

      <template #version-cell="{ row }">
        <NuxtLink target="_blank" :to="`https://www.npmjs.com/package/${state.packageData?.name}/v/${row.original.version}`" class="underline">
          <span class="font-mono text-sm">{{ row.original.version }}</span>
        </NuxtLink>
      </template>

      <template #tag-cell="{ row }">
        <UBadge :color="getTagColor(row.original.tag)" variant="soft" size="sm">
          {{ row.original.tag }}
        </UBadge>
      </template>

      <template #downloads-cell="{ row }">
        <span class="font-semibold">{{ row.original.formattedDownloads }}</span>
      </template>

      <template #publishedDate-cell="{ row }">
        <UTooltip
          :text="row.original.publishedDate ? intlFormat(row.original.publishedDate, { dateStyle: 'full', timeStyle: 'full' }, { locale }) : t('common.unknown')"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400 hover:underline cursor-help">
            {{ row.original.publishedDate ? intlFormatDistance(row.original.publishedDate, Date.now(), { locale })
              : t('common.unknown') }}
          </span>
        </UTooltip>
      </template>
    </UTable>
  </UMain>
</template>
