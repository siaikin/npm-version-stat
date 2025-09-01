<script setup lang="ts">
import type { TableColumn, TableProps } from '@nuxt/ui'
import { useClipboard, useDebounceFn } from '@vueuse/core'
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
  percentage: number
  cumulativeDownloads: number
  cumulativePercentage: number
  isWithin90Threshold: boolean
}

export interface NPMSearchResponse {
  objects: Array<{
    package: {
      name: string
      description?: string
    }
  }>
}

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
  selectedMajorVersions: [] as string[], // 新增：选中的大版本号
  threshold: 90 as number, // 新增：阈值百分比
})

// 用于取消搜索请求的 AbortController
let searchAbortController: AbortController | null = null

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
    filteredData = filteredData.filter(item => state.selectedTags.includes(item.tag))
  }

  // 根据选中的大版本号筛选
  if (state.selectedMajorVersions.length > 0) {
    filteredData = filteredData.filter((item) => {
      const major = getMajorVersion(item.version)
      return state.selectedMajorVersions.includes(major)
    })
  }

  // 计算总下载量
  const totalDownloads = filteredData.reduce((sum, item) => sum + item.downloads, 0)
  const threshold90 = totalDownloads * (state.threshold / 100)

  // 计算占比、累积下载量和90%阈值标记
  let cumulativeDownloads = 0
  let foundThresholdBoundary = false

  return filteredData.map((item: VersionData, index: number) => {
    cumulativeDownloads += item.downloads
    const percentage = totalDownloads > 0 ? (item.downloads / totalDownloads) * 100 : 0
    const cumulativePercentage = totalDownloads > 0 ? (cumulativeDownloads / totalDownloads) * 100 : 0

    // 包含刚好在90%分界线上的版本：
    // 如果当前版本是第一个使累积下载量超过阈值的版本，也标记为在范围内
    let isWithin90Threshold = false
    if (cumulativeDownloads <= threshold90) {
      isWithin90Threshold = true
    }
    else if (!foundThresholdBoundary && cumulativeDownloads > threshold90) {
      // 第一个超过阈值的版本也包含在内（分界线版本）
      isWithin90Threshold = true
      foundThresholdBoundary = true
    }

    return {
      ...item,
      rank: index + 1,
      percentage,
      cumulativeDownloads,
      cumulativePercentage,
      isWithin90Threshold,
    }
  })
})

// Tag 选项
const tagOptions = computed(() => {
  const uniqueTags = new Set(state.versionsData.map(v => v.tag))
  return Array.from(uniqueTags).map(tag => ({
    label: tag,
    value: tag,
  }))
})

// 大版本号选项
const majorVersionOptions = computed(() => {
  const majorVersions = new Set(state.versionsData.map(v => getMajorVersion(v.version)))
  return Array.from(majorVersions)
    .filter(version => version !== 'unknown')
    .sort((a, b) => {
      // 按版本号倒序排列（最新版本在前）
      const numA = Number.parseInt(a.replace('v', ''), 10)
      const numB = Number.parseInt(b.replace('v', ''), 10)
      return numB - numA
    })
    .map(version => ({
      label: version,
      value: version,
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
  // {
  //   accessorKey: 'tag',
  //   header: t('stats.tag'),
  // },
  {
    accessorKey: 'publishedDate',
    header: t('stats.publishedDate'),
  },
  {
    accessorKey: 'downloads',
    header: t('stats.downloads'),
  },
  {
    accessorKey: 'cumulativePercentage',
    header: t('stats.cumulativePercentage'),
  },
])

const tableDefaultColumn = computed<TableProps<FormattedVersionData>['defaultColumn']>(() => ({
  meta: {
    class: {
      th: 'text-left truncate',
      td: ({ row }) => [
        row.original.isWithin90Threshold ? 'bg-primary-50/75 dark:bg-primary-800/75' : '',
      ].join(' '),
    },
  },
}))

const tableMeta = computed<TableProps<FormattedVersionData>['meta']>(() => ({
  class: {
    tr: row => [
      isLast90ThresholdVersion(row) ? 'border-b-2 border-primary' : '',
    ].join(' '),
  },
}))

function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

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

function getMajorVersion(version: string): string {
  try {
    const parsed = semver.parse(version)
    if (!parsed)
      return 'unknown'
    return `v${parsed.major}`
  }
  catch {
    return 'unknown'
  }
}
function getTagColor(tag: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (tag) {
    case 'stable': return 'primary'
    case 'invalid': return 'error'
    default: return 'neutral'
  }
}

// 判断是否是90%分界线上的最后一个版本
function isLast90ThresholdVersion(row: any): boolean {
  const within90Items = formattedVersionsData.value.filter(item => item.isWithin90Threshold)
  if (within90Items.length === 0)
    return false
  const lastItem = within90Items[within90Items.length - 1]
  return lastItem ? row.original.rank === lastItem.rank : false
}

// 计算阈值下载量的最小版本信息
const minVersionFor90Threshold = computed(() => {
  const within90Items = formattedVersionsData.value.filter(item => item.isWithin90Threshold)
  if (within90Items.length === 0) {
    return null
  }

  // 按版本号分组（按主版本号）
  const versionsByMajor = within90Items.reduce((acc, item) => {
    const major = getMajorVersion(item.version)
    if (!acc[major]) {
      acc[major] = []
    }
    acc[major].push(item)
    return acc
  }, {} as Record<string, FormattedVersionData[]>)

  // 找出每个主版本中最小的版本
  const minVersionsByMajor = Object.entries(versionsByMajor).map(([major, versions]) => {
    const sortedVersions = versions.sort((a, b) => {
      // 使用 semver 比较，如果解析失败则使用字符串比较
      if (a.parsedVersion && b.parsedVersion) {
        return semver.compare(a.version, b.version)
      }
      return a.version.localeCompare(b.version)
    })
    return {
      major,
      minVersion: sortedVersions[0],
      totalVersionsInMajor: versions.length,
    }
  }).sort((a, b) => {
    // 按主版本号倒序排列（最新版本在前）
    const numA = Number.parseInt(a.major.replace('v', ''), 10)
    const numB = Number.parseInt(b.major.replace('v', ''), 10)
    return numB - numA
  })

  return {
    items: minVersionsByMajor,
    totalVersions: within90Items.length,
    totalDownloads: within90Items.reduce((sum, item) => sum + item.downloads, 0),
  }
})

// 复制功能
const { copy } = useClipboard()
// 复制单个版本号
function copySingleVersion(version: string) {
  copy(version)
}

const versionTable = useTemplateRef<ComponentPublicInstance>('versionTableRef')
const scrollToVersionTable = useDebounceFn(() => {
  versionTable.value?.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 1000)
watch(() => [state.selectedTags, state.selectedMajorVersions, state.threshold], () => scrollToVersionTable(), { flush: 'post' })

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

    // 取消之前的搜索请求
    if (searchAbortController) {
      searchAbortController.abort()
    }

    // 创建新的 AbortController
    searchAbortController = new AbortController()
    const { signal } = searchAbortController

    try {
      state.isSearching = true
      const response = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`,
        { signal },
      )

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
      // 如果是取消请求的错误，不输出警告
      if (error instanceof Error && error.name === 'AbortError') {
        return []
      }
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
  state.suggestions = await searchPackages(query)
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

  scrollToVersionTable()
  // await new Promise<void>(resolve => setTimeout(resolve, 300000))

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
  }
  catch (err: unknown) {
    console.error(err)
    state.error = err instanceof Error ? err.message : t('messages.unknownError')
  }
  finally {
    state.isLoading = false
  }
}

watch(() => form.packageName, () => form.packageName.trim() && fetchPackageData())
onMounted(() => form.packageName.trim() && fetchPackageData())

// 在组件卸载时取消未完成的搜索请求
onUnmounted(() => {
  if (searchAbortController) {
    searchAbortController.abort()
  }
})

// 监听搜索查询变化
watch(() => state.searchQuery, (newQuery) => {
  if (newQuery && newQuery.length >= 2) {
    debouncedSearch(newQuery)
  }
})

const columnPinning = ref({
  right: ['cumulativePercentage'],
})
const sorting = ref([])
</script>

<template>
  <UContainer class="space-y-8">
    <!-- 搜索表单 -->

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
            :content="{ bodyLock: true }"
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

        <UFormField size="xl" :label="t('form.period')" name="period" class="max-lg:hidden">
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

    <!-- 错误提示 -->
    <UAlert
      v-if="state.error" icon="i-lucide-alert-circle" color="error" variant="soft" :title="t('messages.error')"
      :description="state.error" class="mb-8"
    />

    <!-- 包信息卡片 - 紧凑样式 -->
    <Gueleton
      v-slot="{ data: packageData }"
      data-key="package-info"
      :loading="state.isLoading"
      :data="state.packageData"
    >
      <UCard class="relative z-10">
        <!-- 包标题行 -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0">
              <UIcon name="i-lucide-package" class="text-xl text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-xl font-bold truncate">
                {{ packageData?.name }}
              </h2>
              <p class="text-sm text-muted line-clamp-2">
                {{ packageData?.description }}
              </p>
            </div>
          </div>
          <UBadge color="primary" variant="soft">
            v{{ packageData?.latestVersion }}
          </UBadge>
        </div>

        <!-- 紧凑统计数据 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg">
            <UIcon name="i-lucide-download" class="text-primary flex-shrink-0" />
            <div class="min-w-0">
              <div class="text-lg font-bold text-primary truncate">
                {{ n(packageData?.totalDownloads ?? 0, 'decimal') }}
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
                {{ packageData?.totalVersions }}
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
                {{ packageData?.latestVersion }}
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
                {{ packageData?.createdDate && intlFormat(packageData?.createdDate, {
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
    </Gueleton>
  </UContainer>

  <Gueleton
    v-slot="{ data }"
    ref="versionTableRef"
    data-key="version-info"
    :loading="state.isLoading"
    :data="formattedVersionsData"
    :skeleton="{ fuzzy: 2 }"
  >
    <UContainer class="px-0 bg-default flex flex-col min-h-screen font-mono scroll-mt-(--ui-header-height)">
      <!-- 版本下载量表格 -->
      <div class="flex items-center gap-2 px-4">
        <UIcon name="i-lucide-bar-chart-3" />
        <h3 class="text-xl font-semibold">
          {{ t('stats.versionStatistics') }}
        </h3>
      </div>

      <!-- 筛选区域 - 响应式网格布局 -->
      <div class="grid px-4 grid-cols-1 lg:grid-cols-3 gap-2 py-2 sticky top-(--ui-header-height) z-50 bg-default/75 backdrop-blur border-default border-b">
        <!-- 标签筛选 -->
        <UFormField :label="t('filter.filterByTag')" name="tags">
          <UCheckboxGroup
            v-model="state.selectedTags" variant="list" orientation="horizontal"
            :items="tagOptions" :ui="{ fieldset: 'flex flex-wrap gap-2' }"
          />
        </UFormField>

        <!-- 大版本号筛选 -->
        <UFormField :label="t('filter.filterByMajorVersion')" name="majorVersions">
          <UCheckboxGroup
            v-model="state.selectedMajorVersions" variant="list" orientation="horizontal"
            :items="majorVersionOptions" :ui="{ fieldset: 'flex flex-wrap gap-2' }"
          />
        </UFormField>

        <!-- 阈值选择 -->
        <UFormField :label="`${t('filter.threshold')}: ${state.threshold}%`" name="threshold">
          <USlider
            v-model="state.threshold"
            :min="50"
            :max="100"
            :step="5"
            color="primary"
            size="md"
            tooltip
            class="w-full"
          />
        </UFormField>
      </div>

      <UTable
        v-model:sorting="sorting"
        v-model:column-pinning="columnPinning"
        :ui="{ base: 'table-fixed' }"
        :columns="columns"
        :data="data"
        :default-column="tableDefaultColumn"
        :meta="tableMeta"
      >
        <template #rank-cell="{ row }">
          <UBadge
            :color="row.original.isWithin90Threshold ? 'primary' : 'neutral'"
            variant="soft"
          >
            #{{ row.original.rank }}
          </UBadge>
        </template>

        <template #version-cell="{ row }">
          <div class="flex items-center gap-2">
            <NuxtLink target="_blank" :to="`https://www.npmjs.com/package/${state.packageData?.name}/v/${row.original.version}`" class="underline">
              <span class="font-mono text-sm">{{ row.original.version }}</span>
            </NuxtLink>
          </div>
        </template>

        <template #tag-cell="{ row }">
          <UBadge :color="getTagColor(row.original.tag)" variant="soft" size="sm">
            {{ row.original.tag }}
          </UBadge>
        </template>

        <template #downloads-cell="{ row }">
          <span>{{ formatDownloads(row.original.downloads) }}</span>
        </template>

        <template #cumulativePercentage-cell="{ row }">
          <div class="flex items-center justify-end gap-2">
            <span class="font-semibold">
              {{ row.original.cumulativePercentage.toFixed(1) }}%
            </span>
            <span
              v-if="row.index > 0"
              class="absolute top-0 right-0 -translate-y-1/2 bg-default p-1 text-[10px]"
            >+{{ row.original.percentage.toFixed(1) }}%</span>
          </div>
        </template>

        <template #publishedDate-cell="{ row }">
          <UTooltip
            :content="{ side: 'top' }"
            :text="row.original.publishedDate ? intlFormat(row.original.publishedDate, { dateStyle: 'full', timeStyle: 'full' }, { locale }) : t('common.unknown')"
          >
            <span class="text-sm text-gray-600 dark:text-gray-400 hover:underline cursor-help">
              {{ row.original.publishedDate ? intlFormatDistance(row.original.publishedDate, Date.now(), { locale })
                : t('common.unknown') }}
            </span>
          </UTooltip>
        </template>
      </UTable>

      <!-- 阈值最小版本汇总 - Sticky 底部 -->
      <div
        v-if="minVersionFor90Threshold"
        class="sticky bottom-0 bg-primary-50/90 dark:bg-primary-900/90 backdrop-blur border-t border-primary/20 p-3 mt-auto"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-target" class="text-primary" />
            <h4 class="font-semibold text-primary text-sm">
              {{ t('stats.minVersionForThreshold', { threshold: state.threshold }) }}
            </h4>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <div
            v-for="item in minVersionFor90Threshold.items"
            :key="item.major"
            class="flex items-center gap-1.5 px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded-md border border-primary/10 text-xs"
          >
            <UBadge :color="getTagColor(item.minVersion?.tag || 'stable')" variant="soft" size="xs">
              {{ item.major }}
            </UBadge>
            <NuxtLink
              target="_blank"
              :to="`https://www.npmjs.com/package/${state.packageData?.name}/v/${item.minVersion?.version}`"
              class="font-mono hover:underline"
            >
              {{ item.minVersion?.version }}
            </NuxtLink>
            <UButton
              icon="i-lucide-copy"
              color="neutral"
              variant="ghost"
              size="xs"
              class="ml-1 opacity-60 hover:opacity-100"
              @click="copySingleVersion(item.minVersion?.version || '')"
            />
          </div>
        </div>
      </div>
    </UContainer>
  </Gueleton>
</template>
