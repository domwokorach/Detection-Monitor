<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { resolvedTheme } from '@/stores/theme'

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer])

const props = defineProps<{ option: EChartsCoreOption; height?: string; label: string }>()
const el = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts>()
let observer: ResizeObserver | undefined

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
/** Colours that must follow the theme; merged over the caller's option so charts need no theme logic. */
function themed(option: EChartsCoreOption): EChartsCoreOption {
  const axis = { axisLabel: { color: css('--c-fg3') }, axisLine: { lineStyle: { color: css('--c-line') } }, splitLine: { lineStyle: { color: css('--c-line') } } }
  const series = ((option.series as { type?: string }[] | undefined) ?? []).map(s => (s.type === 'pie' ? { itemStyle: { borderColor: css('--c-ink-800') } } : {}))
  return {
    tooltip: { backgroundColor: css('--c-ink-700'), borderColor: css('--c-line'), textStyle: { color: css('--c-fg') } },
    ...(option.xAxis ? { xAxis: axis } : {}), ...(option.yAxis ? { yAxis: { ...axis, axisLine: undefined } } : {}), series,
  }
}
const apply = () => chart.value?.setOption(themed(props.option))

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  chart.value = echarts.init(el.value!, undefined, { renderer: 'canvas' })
  chart.value.setOption({ animation: !reduced, animationDuration: 700, animationEasing: 'cubicOut', ...props.option })
  apply()
  observer = new ResizeObserver(() => chart.value?.resize())
  observer.observe(el.value!)
})
watch(() => props.option, o => { chart.value?.setOption(o, { notMerge: false }); apply() }, { deep: true })
watch(resolvedTheme, () => nextTick(apply))
onBeforeUnmount(() => { observer?.disconnect(); chart.value?.dispose() })
</script>

<template><div ref="el" role="img" :aria-label="label" :style="{ height: height ?? '280px', width: '100%' }" /></template>
