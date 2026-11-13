<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { motion } from 'motion-v'
import { ShieldAlert, TriangleAlert, FileCheck2, ArrowLeftRight, Gauge, ArrowUpRight, ArrowDownRight, FlaskConical } from 'lucide-vue-next'
import { data, demo, navigate, rangeDays, refresh, status } from '@/stores/app'
import { alertAt, bandCounts, countBy, customerScores, dayKey, dailyWindow, lastDays, mean, meanBy, pctChange, sum, watchlistCountries } from '@/lib/dashboard'
import { RISK_META, riskLevel } from '@/lib/risk'
import { axisText, gridLine, tooltip } from '@/lib/chart'
import { aggregate, loadGeo, RISK_THRESHOLD, type GeoIndex } from '@/lib/countyRisk'
import Panel from '@/components/ui/Panel.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EChart from '@/components/charts/EChart.vue'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import RiskDonut from '@/components/dashboard/RiskDonut.vue'
import UkRiskMap from '@/components/dashboard/UkRiskMap.vue'
import RecentAlertsTable from '@/components/dashboard/RecentAlertsTable.vue'
import TransactionTable from '@/components/dashboard/TransactionTable.vue'
import AiRiskPanel from '@/components/dashboard/AiRiskPanel.vue'

const loading = computed(() => !status.loaded && !status.error)
const days = computed(() => rangeDays.value)
const keys = computed(() => lastDays(days.value))
const prevKeys = computed(() => lastDays(days.value, days.value))
const compare = computed(() => `vs last ${days.value} days`)
const inKeys = <T,>(items: T[], at: (i: T) => string, k: string[]) => { const s = new Set(k); return items.filter(i => s.has(dayKey(at(i)))) }
const label = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString('en-GB', days.value <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' })

// ---------- KPI row (all values derived from the live/demo API data) ----------
const alertsCur = computed(() => inKeys(data.alerts, alertAt, keys.value))
const alertsPrev = computed(() => inKeys(data.alerts, alertAt, prevKeys.value))
const high = (a: { risk_score: number }) => a.risk_score >= 60
const confirmed = computed(() => data.alerts.filter(a => a.disposition === 'SUSPICIOUS'))
const dailyCur = computed(() => dailyWindow(data.daily, keys.value))
const dailyPrev = computed(() => dailyWindow(data.daily, prevKeys.value))
const txSum = (w: ReturnType<typeof dailyWindow>) => (w.every(Boolean) ? sum(w.map(d => d!.transactions)) : null)

const kpis = computed(() => {
  const k = keys.value
  const day = (a: { created_at: string }) => a.created_at
  const txCur = txSum(dailyCur.value), txPrev = txSum(dailyPrev.value)
  const confCur = inKeys(confirmed.value, a => a.updated_at, k), confPrev = inKeys(confirmed.value, a => a.updated_at, prevKeys.value)
  const avg = (a: { risk_score: number }[]) => mean(a.map(x => x.risk_score))
  const sparkAvg = meanBy(alertsCur.value, k, day, a => a.risk_score).map(v => v ?? 0)
  return [
    { label: 'Total Alerts', value: alertsCur.value.length, icon: ShieldAlert, color: '#65B9EE', change: pctChange(alertsCur.value.length, alertsPrev.value.length), spark: countBy(alertsCur.value, k, day), page: 'alerts' as const },
    { label: 'High Risk Alerts', value: alertsCur.value.filter(high).length, icon: TriangleAlert, color: '#F1A052', change: pctChange(alertsCur.value.filter(high).length, alertsPrev.value.filter(high).length), spark: countBy(alertsCur.value.filter(high), k, day), page: 'alerts' as const },
    { label: 'Confirmed Suspicious', value: confCur.length, icon: FileCheck2, color: '#8DD4FA', change: pctChange(confCur.length, confPrev.length), spark: countBy(confCur, k, a => a.updated_at), page: 'workspace' as const },
    { label: 'Monitored Transactions', value: txCur ?? 0, icon: ArrowLeftRight, color: '#28B99D', change: txCur !== null && txPrev !== null ? pctChange(txCur, txPrev) : null, spark: dailyCur.value.map(d => d?.transactions ?? 0), page: 'transactions' as const },
    { label: 'Avg. Risk Score', value: Math.round(avg(alertsCur.value)), icon: Gauge, color: '#BFE8FF', change: pctChange(avg(alertsCur.value), avg(alertsPrev.value)), spark: sparkAvg, page: 'rules' as const, goodWhenDown: true },
  ]
})

// ---------- Charts ----------
const lineOption = (labels: string[], values: (number | null)[], color: string, opts: { min?: number; max?: number } = {}) => ({
  tooltip: { trigger: 'axis', ...tooltip, axisPointer: { lineStyle: { color: '#1B344D' } } },
  grid: { left: 4, right: 8, top: 10, bottom: 2, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: gridLine } }, axisTick: { show: false }, axisLabel: { color: axisText, fontSize: 9.5, hideOverlap: true } },
  yAxis: { type: 'value', ...opts, minInterval: 1, splitNumber: 3, axisLabel: { color: axisText, fontSize: 9.5 }, splitLine: { lineStyle: { color: gridLine, type: 'dashed' } } },
  series: [{ type: 'line', smooth: 0.35, symbol: 'circle', symbolSize: 4, showSymbol: false, connectNulls: true, data: values, lineStyle: { width: 1.5, color, shadowColor: color, shadowBlur: 6 }, itemStyle: { color },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + '40' }, { offset: 1, color: color + '00' }] } } }],
})
const overTime = computed(() => lineOption(keys.value.map(label), countBy(alertsCur.value, keys.value, alertAt), '#65B9EE'))
const overTimeTotal = computed(() => alertsCur.value.length)

const bandsAlerts = computed(() => bandCounts(alertsCur.value.map(a => a.risk_score)))
const customerBands = computed(() => bandCounts(customerScores(data.accounts, data.transactions)))

const trendKeys = computed(() => lastDays(14))
const trendVals = computed(() => meanBy(data.alerts, trendKeys.value, alertAt, a => a.risk_score).map(v => (v === null ? null : Math.round(v))))
const trendOption = computed(() => lineOption(trendKeys.value.map(k => new Date(`${k}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })), trendVals.value, '#8DD4FA', { min: 0, max: 100 }))
const trendLatest = computed(() => [...trendVals.value].reverse().find(v => v !== null) ?? null)
const trendDelta = computed(() => { const v = trendVals.value.filter((x): x is number => x !== null); return v.length >= 2 ? pctChange(v[v.length - 1], v[0]) : null })

const compliance = computed(() => {
  const tx = data.overview?.transactions ?? 0, screened = data.overview?.screened ?? 0
  const alerts = data.alerts, triaged = alerts.filter(a => a.status !== 'OPEN').length
  const rules = data.rules, active = rules.filter(r => r.enabled).length
  const row = (name: string, n: number, d: number) => ({ name, n, d, pct: d ? (n / d) * 100 : 0 })
  return [row('Transactions screened', screened, tx), row('Alerts triaged', triaged, alerts.length), row('Active scoring rules', active, rules.length)]
})

const wlKeys = computed(() => lastDays(7))
const wlSet = computed(() => watchlistCountries(data.rules))
const wlHits = computed(() => data.transactions.filter(t => wlSet.value.has(t.country)))
const wlCounts = computed(() => countBy(wlHits.value, wlKeys.value, t => t.occurred_at))
const wlPrev = computed(() => inKeys(wlHits.value, t => t.occurred_at, lastDays(7, 7)).length)
const wlOption = computed(() => ({
  tooltip: { trigger: 'axis', ...tooltip, axisPointer: { type: 'shadow', shadowStyle: { color: 'rgb(101 185 238 / 0.06)' } } },
  grid: { left: 4, right: 4, top: 6, bottom: 2, containLabel: true },
  xAxis: { type: 'category', data: wlKeys.value.map(k => new Date(`${k}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })), axisTick: { show: false }, axisLine: { lineStyle: { color: gridLine } }, axisLabel: { color: axisText, fontSize: 9.5 } },
  yAxis: { type: 'value', minInterval: 1, splitNumber: 3, axisLabel: { color: axisText, fontSize: 9.5 }, splitLine: { lineStyle: { color: gridLine, type: 'dashed' } } },
  series: [{ type: 'bar', barWidth: 14, data: wlCounts.value, itemStyle: { borderRadius: [3, 3, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#8DD4FA' }, { offset: 1, color: '#1E5A91' }] } } }],
}))

// ---------- UK risk map: real alerts with score >= 60, grouped by the county of each account (lib/countyRisk.ts) ----------
const geo = ref<GeoIndex>()
const county = computed(() => (geo.value ? aggregate(geo.value, data.alerts, data.accounts) : { counties: [], unlocated: 0 }))
const locations = computed(() => county.value.counties)
const refreshedAt = computed(() => status.lastUpdated?.toLocaleTimeString('en-GB') ?? '')
const mapRef = ref<InstanceType<typeof UkRiskMap>>()
onMounted(async () => {
  try { geo.value = await loadGeo() } catch { /* the map component shows its own load error */ }
})
const topLocations = computed(() => [...locations.value].sort((a, b) => b.alerts - a.alerts).slice(0, 7))
const topMax = computed(() => topLocations.value[0]?.alerts ?? 1)
</script>

<template>
  <div class="space-y-3">
    <ErrorState v-if="status.error && !status.loaded" :message="status.error" @retry="refresh()" />

    <!-- KPI row -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <template v-if="loading"><Skeleton v-for="n in 5" :key="n" class="h-[100px] !rounded-lg" /></template>
      <KpiCard v-for="(k, i) in kpis" v-else :key="k.label" v-bind="k" :compare="compare" :delay="i * 0.06" @open="navigate(k.page)" />
    </div>

    <!-- Analytics grid -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-6 2xl:grid-cols-12">
      <Panel class="lg:col-span-6 2xl:col-span-5" title="UK Risk Map" subtitle="Real-time county-level fraud risk for alerts with score 60 and above" :delay="0.25">
        <template #actions>
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            <span class="inline-flex items-center gap-1.5 rounded border border-line px-1.5 py-0.5 text-[9.5px] text-fg2" role="status" :title="status.live ? 'Receiving live updates' : 'Connection lost, retrying'">
              <span class="size-1.5 rounded-full" :class="status.live ? 'bg-ok' : 'bg-sev-med'" aria-hidden="true" />{{ status.live ? 'Live' : 'Reconnecting' }}<span v-if="refreshedAt" class="text-fg3 tnum">· {{ refreshedAt }}</span>
            </span>
            <span class="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium text-hl" title="High Risk Counties Only">Risk Threshold: {{ RISK_THRESHOLD }}+</span>
            <span v-if="demo" class="inline-flex items-center gap-1 rounded border border-sev-med/30 bg-sev-med/10 px-1.5 py-0.5 text-[9.5px] text-sev-med" title="Generated demo data; connect the backend for real alerts."><FlaskConical :size="10" aria-hidden="true" /> Demo data</span>
          </div>
        </template>
        <div class="min-h-0 flex-1"><UkRiskMap ref="mapRef" :locations="locations" :unlocated="county.unlocated" /></div>
      </Panel>

      <div class="grid gap-3 lg:col-span-3 2xl:col-span-4" style="grid-template-rows: auto 1fr">
        <Panel title="Alerts by Risk Level" :delay="0.3">
          <Skeleton v-if="loading" class="h-[118px]" />
          <RiskDonut v-else :slices="bandsAlerts" center-label="Total alerts" label="Donut chart of alerts by risk level" />
        </Panel>
        <Panel title="Alerts Over Time" :delay="0.35">
          <template #actions><div class="text-right"><p class="text-base leading-none font-semibold text-fg tnum">{{ overTimeTotal.toLocaleString('en-GB') }}</p><p class="mt-1 text-[9.5px] text-fg3">last {{ days }} days</p></div></template>
          <Skeleton v-if="loading" class="h-[150px]" />
          <EChart v-else :option="overTime" height="100%" class="min-h-[150px] flex-1" label="Line chart of alerts raised per day" />
        </Panel>
      </div>

      <Panel class="lg:col-span-3 2xl:col-span-3" title="Top Risk Locations" :subtitle="`Counties by active alerts at ${RISK_THRESHOLD}+`" :delay="0.4">
        <template v-if="demo" #actions><span class="rounded border border-sev-med/30 bg-sev-med/10 px-1.5 py-0.5 text-[9.5px] text-sev-med">Demo data</span></template>
        <ul class="flex flex-1 flex-col justify-between gap-1.5">
          <li v-for="(l, i) in topLocations" :key="l.code">
            <button type="button" class="focus-ring group w-full rounded-md px-1.5 py-1.5 text-left transition-colors duration-200 hover:bg-white/[0.04]" :aria-label="`Show ${l.name} on the map: ${l.alerts} alerts`" @click="mapRef?.select(l.code)">
              <div class="flex items-baseline justify-between text-[11px]"><span class="truncate text-fg">{{ l.name }}</span><span class="flex items-center gap-2 tnum"><span class="text-fg">{{ l.alerts.toLocaleString('en-GB') }}</span><span class="w-12 text-right text-[10px]" :style="{ color: RISK_META[riskLevel(l.riskScore)].color }">{{ RISK_META[riskLevel(l.riskScore)].label }}</span></span></div>
              <div class="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-600">
                <motion.div :initial="{ width: 0 }" :animate="{ width: `${(l.alerts / topMax) * 100}%` }" :transition="{ duration: 0.7, delay: 0.5 + i * 0.05, ease: 'easeOut' }" class="h-full rounded-full" :style="{ background: RISK_META[riskLevel(l.riskScore)].color, boxShadow: `0 0 8px ${RISK_META[riskLevel(l.riskScore)].color}88` }" />
              </div>
            </button>
          </li>
          <li v-if="!topLocations.length" class="py-6 text-center text-[11px] text-fg3">No counties at {{ RISK_THRESHOLD }}+ right now</li>
        </ul>
      </Panel>
    </div>

    <!-- Operational monitoring -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-6 2xl:grid-cols-12">
      <Panel class="lg:col-span-3 2xl:col-span-4" title="Recent Alerts" :delay="0.45"><RecentAlertsTable :loading="loading" /></Panel>
      <Panel class="lg:col-span-3 2xl:col-span-5" title="Transaction Monitoring" :delay="0.5">
        <template #actions><span class="flex items-center gap-1.5 text-[10px] text-fg2"><span class="size-1.5 rounded-full bg-ok shadow-[0_0_6px] shadow-ok" aria-hidden="true" />{{ status.live ? 'Live feed' : 'Reconnecting' }}</span></template>
        <TransactionTable :loading="loading" />
      </Panel>
      <Panel class="lg:col-span-6 2xl:col-span-3" title="AI Risk Intelligence" :delay="0.55"><AiRiskPanel :loading="loading" /></Panel>
    </div>

    <!-- Bottom analytics -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <Panel title="Customer Risk Distribution" subtitle="By highest transaction risk" :delay="0.6">
        <Skeleton v-if="loading" class="h-[118px]" />
        <RiskDonut v-else :slices="customerBands" center-label="Total customers" label="Donut chart of customers by risk band" />
      </Panel>
      <Panel title="Risk Score Trend" :delay="0.65">
        <template #actions><div class="text-right"><p class="text-base leading-none font-semibold text-fg tnum">{{ trendLatest ?? '—' }}</p>
          <p v-if="trendDelta !== null" class="mt-1 flex items-center justify-end gap-0.5 text-[9.5px] tnum" :class="trendDelta >= 0 ? 'text-sev-high' : 'text-ok'"><component :is="trendDelta >= 0 ? ArrowUpRight : ArrowDownRight" :size="10" aria-hidden="true" />{{ Math.abs(trendDelta).toFixed(1) }}% over 14 days</p></div></template>
        <Skeleton v-if="loading" class="h-[118px]" />
        <EChart v-else :option="trendOption" height="118px" label="Line chart of average alert risk score per day over 14 days" />
      </Panel>
      <Panel title="Compliance Status" subtitle="Operational coverage" :delay="0.7">
        <Skeleton v-if="loading" class="h-[118px]" />
        <ul v-else class="space-y-3.5 pt-1">
          <li v-for="(c, i) in compliance" :key="c.name">
            <div class="flex items-baseline justify-between text-[11px]"><span class="text-fg2">{{ c.name }}</span><span class="text-fg tnum">{{ c.pct.toFixed(1) }}% <span class="text-fg3">({{ c.n }}/{{ c.d }})</span></span></div>
            <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-600" role="progressbar" :aria-valuenow="Math.round(c.pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="c.name">
              <motion.div :initial="{ width: 0 }" :animate="{ width: `${c.pct}%` }" :transition="{ duration: 0.8, delay: 0.75 + i * 0.08, ease: 'easeOut' }" class="h-full rounded-full bg-gradient-to-r from-ok to-hl" />
            </div>
          </li>
        </ul>
      </Panel>
      <Panel title="Watchlist Hits" :subtitle="wlSet.size ? `Destinations: ${[...wlSet].join(', ')}` : 'No active country watchlist'" :delay="0.75">
        <template #actions><div class="text-right"><p class="text-base leading-none font-semibold text-fg tnum">{{ sum(wlCounts) }}</p>
          <p class="mt-1 text-[9.5px] text-fg3 tnum"><template v-if="pctChange(sum(wlCounts), wlPrev) !== null">{{ pctChange(sum(wlCounts), wlPrev)! >= 0 ? '+' : '−' }}{{ Math.abs(pctChange(sum(wlCounts), wlPrev)!).toFixed(1) }}% vs prior 7d</template><template v-else>last 7 days</template></p></div></template>
        <Skeleton v-if="loading" class="h-[118px]" />
        <EChart v-else :option="wlOption" height="118px" label="Bar chart of watchlist country hits per day over 7 days" />
      </Panel>
    </div>
  </div>
</template>
