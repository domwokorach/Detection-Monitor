<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as d3 from 'd3'
import { Minus, Plus, Maximize2, Search } from 'lucide-vue-next'
import { BAND_META, RISK_THRESHOLD, bandOf, loadGeo, type CountyArea, type CountyRisk, type GeoIndex, type Nation } from '@/lib/countyRisk'

const props = defineProps<{ locations: CountyRisk[]; unlocated?: number }>()
type Row = CountyArea & { loc?: CountyRisk }

const NATIONS: { id: 'All' | Nation; label: string }[] = [{ id: 'All', label: 'All UK' }, { id: 'England', label: 'England' }, { id: 'Scotland', label: 'Scotland' }, { id: 'Wales', label: 'Wales' }, { id: 'Northern Ireland', label: 'N. Ireland' }]
const PREFIX: Record<string, Nation> = { E: 'England', S: 'Scotland', W: 'Wales', N: 'Northern Ireland' }

const box = ref<HTMLDivElement>()
const svgEl = ref<SVGSVGElement>()
const nation = ref<'All' | Nation>('All')
const loading = ref(true)
const error = ref('')
const hover = ref<{ row: Row; x: number; y: number } | null>(null)
const selected = ref<string | null>(null)
const k = ref(1)
const query = ref('')
const searchOpen = ref(false)
const active = ref(0)
const geo = shallowRef<GeoIndex>()

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const dur = (ms: number) => (reduced() ? 0 : ms)
const fmt = (n: number) => n.toLocaleString('en-GB')
const byCode = computed(() => new Map(props.locations.map(l => [l.code, l])))
const maxSuspicious = computed(() => Math.max(1, ...props.locations.map(l => l.suspicious)))

let width = 0, height = 0
let rows: Row[] = []
const projection = d3.geoMercator()
const path = d3.geoPath(projection)
const radius = d3.scaleSqrt().range([0, 16])
const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 16])
const svgSel = shallowRef<d3.Selection<SVGSVGElement, unknown, null, undefined>>()
type G = d3.Selection<SVGGElement, unknown, null, undefined>
let gViewport: G
let nationPaths: d3.Selection<SVGPathElement, GeoIndex['nations']['features'][number], SVGGElement, unknown>
let areaPaths: d3.Selection<SVGPathElement, Row, SVGGElement, unknown>
let markers: d3.Selection<SVGCircleElement, Row, SVGGElement, unknown>
let ro: ResizeObserver | undefined
let previous = new Map<string, string>()

const inFilter = (r: Row) => nation.value === 'All' || r.nation === nation.value
// Markers grow slower than the map so zooming separates dense areas.
const markerR = (r: Row) => (r.loc ? radius(r.loc.suspicious) / Math.sqrt(k.value) : 0) * (inFilter(r) ? 1 : 0.5)
const colour = (r: Row) => (r.loc ? BAND_META[bandOf(r.loc.riskScore) ?? 'medium-high'].color : 'none')

async function load() {
  try {
    geo.value = await loadGeo()
    rows = geo.value.counties.map(c => ({ ...c, loc: byCode.value.get(c.code) }))
    build()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not load UK boundaries'
  } finally { loading.value = false }
}

function build() {
  const svg = d3.select(svgEl.value!)
  svgSel.value = svg
  svg.selectAll('*').remove()
  gViewport = svg.append('g')
  nationPaths = gViewport.append('g').selectAll<SVGPathElement, GeoIndex['nations']['features'][number]>('path').data(geo.value!.nations.features).join('path').attr('class', 'uk-nation')
  areaPaths = gViewport.append('g').selectAll<SVGPathElement, Row>('path').data(rows, d => (d as Row).code).join('path').attr('class', 'uk-area')
    .on('pointerenter pointermove', (ev: PointerEvent, r) => showHover(r, ev))
    .on('pointerleave', () => { hover.value = null })
    .on('click', (ev: MouseEvent, r) => { ev.stopPropagation(); if (r.loc) select(r.code) })
  markers = gViewport.append('g').selectAll<SVGCircleElement, Row>('circle').data(rows, d => (d as Row).code).join('circle').attr('class', 'uk-marker').attr('r', 0)
    .on('pointerenter pointermove', (ev: PointerEvent, r) => showHover(r, ev))
    .on('pointerleave', () => { hover.value = null })
    .on('click', (ev: MouseEvent, r) => { ev.stopPropagation(); select(r.code) })
  svg.on('click', () => { selected.value = null; paintSelection() })
  zoom.on('zoom', ({ transform }) => { k.value = transform.k; gViewport.attr('transform', transform.toString()); sizeStrokes(); hover.value = null })
  svg.call(zoom).on('dblclick.zoom', null)
  layout()
  paint(true)
  ro = new ResizeObserver(() => { if (box.value && box.value.clientWidth !== width) { layout(); hover.value = null } })
  ro.observe(box.value!)
}

function layout() {
  const el = box.value!
  width = el.clientWidth; height = el.clientHeight
  d3.select(svgEl.value!).attr('viewBox', `0 0 ${width} ${height}`)
  projection.fitExtent([[10, 8], [width - 10, height - 8]], geo.value!.nations)
  radius.range([0, Math.max(9, Math.min(20, Math.min(width, height) * 0.05))])
  zoom.extent([[0, 0], [width, height]]).translateExtent([[-width * 0.15, -height * 0.15], [width * 1.15, height * 1.15]])
  nationPaths.attr('d', path)
  areaPaths.attr('d', r => path(r.feature))
  markers.each(function (r) { const [x, y] = projection(r.lonlat)!; d3.select(this).attr('cx', x).attr('cy', y) })
  sizeStrokes()
}

function sizeStrokes() {
  markers.attr('r', markerR).attr('stroke-width', 1 / Math.sqrt(k.value))
  areaPaths.attr('stroke-width', 0.45 / k.value)
  nationPaths.attr('stroke-width', 0.9 / k.value)
}

/** Re-bind live data. Fills and marker sizes tween; counties whose figures changed brighten briefly. */
function paint(intro = false) {
  if (!markers) return
  radius.domain([0, maxSuspicious.value])
  const now = new Map<string, string>()
  rows.forEach(r => { r.loc = byCode.value.get(r.code); if (r.loc) now.set(r.code, `${r.loc.riskScore}|${r.loc.alerts}|${r.loc.suspicious}`) })
  const changed = (r: Row) => !intro && !!r.loc && previous.get(r.code) !== now.get(r.code)
  previous = now

  areaPaths.classed('has-risk', r => !!r.loc)
    .transition('fill').duration(dur(500)).attr('fill', colour).attr('fill-opacity', r => (r.loc ? 0.3 : 0))
  markers.attr('fill', colour).attr('stroke', r => (r.loc ? '#E6F6FF' : 'none'))
    .style('filter', r => (r.loc ? `drop-shadow(0 0 ${bandOf(r.loc.riskScore) === 'critical' ? 6 : 3}px ${colour(r)})` : null))
    .attr('fill-opacity', 0.4)
  markers.interrupt('size').transition('size').duration(dur(intro ? 800 : 500)).ease(d3.easeCubicOut)
    .delay((_, i) => (intro ? dur(Math.min(i, 120) * 3) : 0)).attr('r', markerR)
  areaPaths.filter(changed).interrupt('flash').attr('stroke', '#E6F6FF').attr('stroke-opacity', 1)
    .transition('flash').duration(dur(1600)).ease(d3.easeCubicOut).attr('stroke-opacity', 0.75).attr('stroke', '#16324D')
  if (hover.value) hover.value = { ...hover.value, row: rows.find(r => r.code === hover.value!.row.code) ?? hover.value.row }
}

function paintSelection() {
  areaPaths.classed('is-selected', r => r.code === selected.value)
  markers.classed('is-selected', r => r.code === selected.value)
}

function showHover(r: Row, ev: PointerEvent) {
  if (!r.loc || !box.value) return
  const b = box.value.getBoundingClientRect()
  hover.value = { row: r, x: ev.clientX - b.left, y: ev.clientY - b.top }
}

function zoomTo(bounds: [[number, number], [number, number]], maxK = 16) {
  const [[x0, y0], [x1, y1]] = bounds
  const s = Math.max(1, Math.min(maxK, 0.85 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
  svgSel.value!.transition().duration(dur(700)).ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(width / 2 - (s * (x0 + x1)) / 2, height / 2 - (s * (y0 + y1)) / 2).scale(s))
}
const reset = () => svgSel.value?.transition().duration(dur(600)).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity)
const zoomBy = (f: number) => svgSel.value?.transition().duration(dur(250)).call(zoom.scaleBy, f)

/** Focus a county (from the search box or the Top Risk Locations list). Counties below the threshold still zoom, with a "no activity" note. */
function select(code: string) {
  const r = rows.find(x => x.code === code)
  if (!r) return
  if (nation.value !== 'All' && r.nation !== nation.value) nation.value = 'All'
  selected.value = code
  paintSelection()
  zoomTo(path.bounds(r.feature), 7)
  nextTick(() => { hover.value = { row: r, x: width / 2, y: height / 2 } })
}

watch(() => props.locations, () => paint())
watch(nation, n => {
  if (!markers) return
  const on = (r: Row) => n === 'All' || r.nation === n
  markers.interrupt('filter').transition('filter').duration(dur(400)).style('opacity', r => (on(r) ? 1 : 0.07)).attr('r', markerR)
  markers.style('pointer-events', r => (on(r) ? 'all' : 'none'))
  nationPaths.classed('is-dim', f => n !== 'All' && PREFIX[f.properties.areacd[0]] !== n)
  areaPaths.classed('is-dim', r => n !== 'All' && r.nation !== n).style('pointer-events', r => (on(r) ? null : 'none'))
  if (n === 'All') reset()
  else zoomTo(path.bounds({ type: 'FeatureCollection', features: geo.value!.nations.features.filter(f => PREFIX[f.properties.areacd[0]] === n) }), 8)
})

onMounted(load)
onBeforeUnmount(() => { ro?.disconnect(); svgSel.value?.on('.zoom', null) })
defineExpose({ select })

// ----- county search (ARIA combobox) -----
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const matches = computed(() => {
  const q = norm(query.value.trim())
  if (!q || !geo.value) return []
  return geo.value.counties.filter(c => norm(c.name).includes(q)).sort((a, b) => Number(byCode.value.has(b.code)) - Number(byCode.value.has(a.code)) || a.name.localeCompare(b.name)).slice(0, 7)
})
function choose(c: CountyArea) { query.value = ''; searchOpen.value = false; select(c.code) }
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' && matches.value.length) { active.value = (active.value + 1) % matches.value.length; e.preventDefault() }
  else if (e.key === 'ArrowUp' && matches.value.length) { active.value = (active.value - 1 + matches.value.length) % matches.value.length; e.preventDefault() }
  else if (e.key === 'Enter' && matches.value[active.value]) choose(matches.value[active.value])
  else if (e.key === 'Escape') { query.value = ''; searchOpen.value = false }
}
watch(query, () => { active.value = 0 })

const legendVals = computed(() => { const m = maxSuspicious.value; return [...new Set([m, Math.ceil(m / 3), 1])].filter(v => v >= 1).sort((a, b) => b - a) })
const legendR = (v: number) => Math.max(2, radius(v))
const tipStyle = computed(() => {
  const h = hover.value; if (!h) return {}
  const w = box.value?.clientWidth ?? 0
  return { left: `${Math.min(Math.max(8, h.x + 14), w - 212)}px`, top: `${Math.max(8, h.y - 8)}px` }
})
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const empty = computed(() => !loading.value && !error.value && !props.locations.length)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by nation">
        <button v-for="n in NATIONS" :key="n.id" type="button" class="focus-ring rounded-md border px-2 py-1 text-[10.5px] font-medium transition-all duration-200"
          :class="nation === n.id ? 'border-accent/50 bg-accent/10 text-hl shadow-[0_0_12px_-3px_rgb(101_185_238/0.5)]' : 'border-line text-fg2 hover:text-fg'" :aria-pressed="nation === n.id" @click="nation = n.id">{{ n.label }}</button>
      </div>
      <div class="relative w-40">
        <Search :size="12" class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg3" aria-hidden="true" />
        <input v-model="query" type="search" role="combobox" aria-label="Search counties" aria-autocomplete="list" :aria-expanded="searchOpen && matches.length > 0" aria-controls="county-results" placeholder="Search county…"
          class="focus-ring h-7 w-full rounded-md border border-line bg-ink-950/60 pr-2 pl-7 text-[11px] text-fg placeholder:text-fg3 hover:border-fg3/50" @focus="searchOpen = true" @blur="searchOpen = false" @keydown="onKey">
        <ul v-if="searchOpen && query.trim()" id="county-results" role="listbox" aria-label="Matching counties" class="absolute top-8 right-0 z-20 w-56 rounded-lg border border-line bg-ink-700 p-1 shadow-2xl">
          <li v-if="!matches.length" class="px-2 py-2 text-[11px] text-fg3" role="option" aria-disabled="true" aria-selected="false">No county matches</li>
          <li v-for="(c, i) in matches" :key="c.code" role="option" :aria-selected="i === active" class="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-fg" :class="i === active && 'bg-white/[0.08]'" @pointerdown.prevent="choose(c)">
            <span class="truncate">{{ c.name }}</span><span class="shrink-0 text-[10px]" :class="byCode.has(c.code) ? 'text-hl' : 'text-fg3'">{{ byCode.has(c.code) ? `${byCode.get(c.code)!.riskScore} · ${BAND_META[bandOf(byCode.get(c.code)!.riskScore)!].label}` : 'below 60' }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div ref="box" class="relative min-h-[300px] flex-1 overflow-hidden rounded-md border border-line bg-[radial-gradient(ellipse_at_50%_40%,#0C2036,#06111F)]">
      <svg ref="svgEl" class="absolute inset-0 size-full touch-none" role="img" aria-label="Map of UK counties shaded by fraud risk for alerts scoring 60 and above, with markers sized by suspicious transactions. Use the county search or the Top Risk Locations list for keyboard access." />
      <div v-if="loading" class="absolute inset-0 grid place-items-center text-[11px] text-fg3" role="status"><span class="skeleton absolute inset-3" /><span class="relative">Loading UK boundaries…</span></div>
      <div v-if="error" class="absolute inset-0 grid place-items-center p-6 text-center text-xs text-sev-crit" role="alert">{{ error }}</div>
      <div v-if="empty" class="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-lg border border-line bg-ink-800/90 p-3 text-center text-[11px] text-fg2" role="status">
        <p class="font-medium text-fg">No counties at risk score {{ RISK_THRESHOLD }}+</p>
        <p class="mt-1 text-fg3">{{ unlocated ? `${unlocated} high-risk alert${unlocated === 1 ? ' has' : 's have'} no location: set la_code on the account.` : 'No active high-risk alerts have a location right now.' }}</p>
      </div>

      <div class="absolute top-2 right-2 flex flex-col overflow-hidden rounded-md border border-line bg-ink-800/90">
        <button class="focus-ring grid size-7 place-items-center text-fg2 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Zoom in" @click="zoomBy(1.6)"><Plus :size="13" /></button>
        <button class="focus-ring grid size-7 place-items-center border-t border-line text-fg2 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Zoom out" @click="zoomBy(1 / 1.6)"><Minus :size="13" /></button>
        <button class="focus-ring grid size-7 place-items-center border-t border-line text-fg2 transition-colors hover:bg-white/[0.06] hover:text-fg" aria-label="Reset map view" @click="nation = 'All'; selected = null; paintSelection(); reset()"><Maximize2 :size="12" /></button>
      </div>

      <div class="pointer-events-none absolute bottom-2 left-2 rounded-md border border-line bg-ink-800/90 px-2.5 py-2 text-[10px] text-fg2">
        <p class="mb-1 font-medium text-fg">Risk score {{ RISK_THRESHOLD }}+ only</p>
        <ul class="space-y-0.5">
          <li v-for="(b, id) in BAND_META" :key="id" class="flex items-center gap-1.5"><span class="size-2 rounded-sm" :style="{ background: b.color }" aria-hidden="true" /><span class="tnum">{{ b.range }}</span><span class="text-fg3">{{ b.label }}</span></li>
        </ul>
        <div class="mt-1.5 flex items-end gap-1.5 border-t border-line pt-1.5" aria-hidden="true">
          <svg v-for="v in legendVals" :key="v" :width="legendR(v) * 2 + 2" :height="legendR(v) * 2 + 2"><circle :cx="legendR(v) + 1" :cy="legendR(v) + 1" :r="legendR(v)" fill="#8DD4FA" fill-opacity=".35" stroke="#E6F6FF" /></svg>
        </div>
        <p class="mt-0.5">Suspicious transactions <span class="tnum text-fg">{{ legendVals.join(' · ') }}</span></p>
      </div>

      <p v-if="unlocated && !empty" class="pointer-events-none absolute right-2 bottom-2 rounded-md border border-line bg-ink-800/90 px-2 py-1 text-[10px] text-fg3">{{ unlocated }} high-risk alert{{ unlocated === 1 ? '' : 's' }} without a location</p>

      <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 translate-y-1" leave-active-class="transition duration-100" leave-to-class="opacity-0">
        <div v-if="hover" class="pointer-events-none absolute z-10 w-52 rounded-lg border border-line bg-ink-700/95 p-2.5 text-[11px] shadow-2xl backdrop-blur" :style="tipStyle" role="status">
          <p class="text-[9.5px] tracking-wide text-fg3 uppercase">{{ hover.row.nation }}</p>
          <p class="mt-0.5 text-[13px] font-semibold text-fg">{{ hover.row.name }}</p>
          <dl v-if="hover.row.loc" class="mt-2 space-y-1 text-fg2">
            <div class="flex justify-between"><dt>Risk score</dt><dd class="tnum" :style="{ color: BAND_META[bandOf(hover.row.loc.riskScore)!].color }">{{ hover.row.loc.riskScore }} · {{ BAND_META[bandOf(hover.row.loc.riskScore)!].label }}</dd></div>
            <div class="flex justify-between"><dt>Suspicious transactions</dt><dd class="text-fg tnum">{{ fmt(hover.row.loc.suspicious) }}</dd></div>
            <div class="flex justify-between"><dt>Alerts</dt><dd class="text-fg tnum">{{ fmt(hover.row.loc.alerts) }}</dd></div>
            <div class="flex justify-between gap-2"><dt>Last updated</dt><dd class="text-right text-fg tnum">{{ when(hover.row.loc.lastUpdated) }}</dd></div>
          </dl>
          <p v-else class="mt-2 text-fg3">No active alerts at {{ RISK_THRESHOLD }}+ in this county.</p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
.uk-nation { fill: #0B1D31; stroke: #1F4466; stroke-linejoin: round; transition: opacity .3s; }
.uk-area { stroke: #16324D; stroke-opacity: .75; fill: none; pointer-events: none; transition: opacity .3s; }
.uk-area.has-risk { pointer-events: all; cursor: pointer; }
.uk-area.has-risk:hover { stroke: #8DD4FA; stroke-opacity: 1; }
.uk-nation.is-dim, .uk-area.is-dim { opacity: .25; }
.uk-marker { cursor: pointer; mix-blend-mode: screen; pointer-events: none; transition: fill-opacity .2s; }
.uk-marker[fill]:not([fill='none']) { pointer-events: all; }
.uk-marker:hover { fill-opacity: .7; }
.uk-area.is-selected { stroke: #F2F7FC; stroke-opacity: 1; }
.uk-marker.is-selected { stroke: #fff; fill-opacity: .7; }
</style>
