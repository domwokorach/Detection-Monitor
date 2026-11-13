import * as d3 from 'd3'

export type Nation = 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
export type Row = {
  city: string; nation: Nation; year: number; geography: string; population: number | null
  p10: number | null; p90: number | null; ratio: number | null; cv_p10: number | null; cv_p90: number | null; status: string; note: string
}
export const NATION_COLOR: Record<Nation, string> = { England: '#65B9EE', Scotland: '#BFE8FF', Wales: '#28B99D', 'Northern Ireland': '#E2A44E' }
export const SOURCE = 'ONS ASHE Table 8.5a (hourly pay, gross) · ONS mid-year population estimates'

const num = (v: string) => (v === '' ? null : Number(v))
export async function loadRows(url = '/data/uk-cities-inequality.csv'): Promise<Row[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return d3.csvParse(await res.text(), d => ({
    city: d.city!, nation: d.nation as Nation, year: +d.year!, geography: d.geography!, population: num(d.population!), p10: num(d.p10!), p90: num(d.p90!),
    ratio: num(d.ratio!), cv_p10: num(d.cv_p10!), cv_p90: num(d.cv_p90!), status: d.status!, note: d.note!,
  }))
}

/** A city is plotted only when it has a valid ratio AND population in every loaded year; the rest are reported as missing. */
export function split(rows: Row[]) {
  const years = [...new Set(rows.map(r => r.year))].sort()
  const cities = [...new Set(rows.map(r => r.city))]
  const ok = (c: string, y: number) => { const r = rows.find(x => x.city === c && x.year === y); return !!r && r.status === 'ok' && r.ratio != null && r.population != null }
  const plotted = cities.filter(c => years.every(y => ok(c, y)))
  const missing = rows.filter(r => !plotted.includes(r.city) && r.status !== 'ok').sort((a, b) => a.city.localeCompare(b.city) || a.year - b.year)
  return { years, plotted, missing }
}

export type Chart = {
  update(year: number): void
  setNations(n: Set<Nation>): void
  setQuery(q: string): void
  select(city: string | null): void
  resetZoom(): void
  destroy(): void
}
type Opts = { onSelect?: (city: string | null) => void; onYear?: (year: number) => void }

const W = 960, H = 540, M = { t: 24, r: 36, b: 56, l: 64 }
const k = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`)

export function createInequalityChart(host: HTMLElement, rows: Row[], opts: Opts = {}): Chart {
  const { years, plotted } = split(rows)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const D = (ms: number) => (reduced ? 0 : ms)
  const by = (c: string, y: number) => rows.find(r => r.city === c && r.year === y)!
  let year = years[0], nations = new Set<Nation>(['England', 'Scotland', 'Wales', 'Northern Ireland']), query = '', selected: string | null = null
  let transform = d3.zoomIdentity

  const all = plotted.flatMap(c => years.map(y => by(c, y)))
  const pops = all.map(r => r.population!), rat = all.map(r => r.ratio!)
  const x0 = d3.scaleLog().domain([Math.min(...pops) / 1.25, Math.max(...pops) * 1.25]).range([M.l, W - M.r])
  const yPad = (Math.max(...rat) - Math.min(...rat)) * 0.18
  const y0 = d3.scaleLinear().domain([Math.min(...rat) - yPad, Math.max(...rat) + yPad]).range([H - M.b, M.t])

  host.replaceChildren()
  host.style.position = 'relative'
  const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'group').attr('aria-label', 'Scatter chart of UK city population against earnings inequality (P90/P10 hourly pay ratio)')
    .style('width', '100%').style('height', 'auto').style('display', 'block')
  const clip = svg.append('defs').append('clipPath').attr('id', 'ineq-clip')
  clip.append('rect').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
  const grid = svg.append('g'), axes = svg.append('g').attr('font-family', 'var(--font-mono)').attr('font-size', 11)
  const plot = svg.append('g').attr('clip-path', 'url(#ineq-clip)')
  const yearMark = svg.append('text').attr('x', W - M.r - 6).attr('y', M.t + 52).attr('text-anchor', 'end').attr('font-size', 64).attr('font-weight', 600).attr('fill', '#10263D').attr('font-family', 'var(--font-mono)').attr('aria-hidden', 'true')
  svg.append('text').attr('x', (W + M.l - M.r) / 2).attr('y', H - 10).attr('text-anchor', 'middle').attr('fill', '#8CA2BA').attr('font-size', 11).text('City population (logarithmic scale)')
  svg.append('text').attr('transform', `translate(16 ${(H - M.b + M.t) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('fill', '#8CA2BA').attr('font-size', 11).text('Earnings inequality · P90 ÷ P10 hourly pay')

  const tip = d3.select(host).append('div').attr('role', 'tooltip').style('position', 'absolute').style('pointer-events', 'none').style('opacity', 0).style('z-index', '5')
    .style('background', '#10263D').style('border', '1px solid #1B344D').style('border-radius', '5px').style('padding', '8px 10px').style('font-size', '11px').style('color', '#F2F7FC').style('min-width', '200px').style('box-shadow', '0 8px 24px rgba(0,0,0,.4)')

  const groups = plot.selectAll<SVGGElement, string>('g.city').data(plotted, d => d).join('g').attr('class', 'city').attr('tabindex', 0).attr('role', 'button').style('cursor', 'pointer').style('outline', 'none')
  groups.append('circle').attr('r', 8).attr('stroke', '#030B14').attr('stroke-width', 1.5).attr('fill', d => NATION_COLOR[by(d, years[0]).nation])
  groups.append('circle').attr('class', 'ring').attr('r', 12).attr('fill', 'none').attr('stroke', '#F2F7FC').attr('stroke-width', 1.25).attr('opacity', 0)
  groups.append('text').attr('x', 13).attr('y', 4).attr('font-size', 11.5).attr('fill', '#F2F7FC').attr('paint-order', 'stroke').attr('stroke', '#030B14').attr('stroke-width', 3).attr('stroke-linejoin', 'round').text(d => d)

  const xz = () => transform.rescaleX(x0), yz = () => transform.rescaleY(y0)
  const visible = (c: string) => nations.has(by(c, year).nation) && (!query || c.toLowerCase().includes(query.toLowerCase()))

  function tipHtml(c: string) {
    const r = by(c, year), a = by(c, years[0]), b = by(c, years[years.length - 1]), dr = b.ratio! - a.ratio!
    const low = [r.cv_p10, r.cv_p90].some(v => v != null && v > 20)
    return `<div style="font-weight:600;font-size:12px">${c}</div><div style="color:#8CA2BA;margin-bottom:6px">${r.nation} · ${r.geography}</div>
      <div style="display:grid;grid-template-columns:auto auto;gap:2px 14px;font-family:var(--font-mono)">
      <span style="color:#8CA2BA;font-family:var(--font-sans)">Year</span><span>${year}</span>
      <span style="color:#8CA2BA;font-family:var(--font-sans)">Population</span><span>${r.population!.toLocaleString('en-GB')}</span>
      <span style="color:#8CA2BA;font-family:var(--font-sans)">P90 ÷ P10</span><span>${r.ratio!.toFixed(2)}× <span style="color:#8CA2BA">(£${r.p90!.toFixed(2)} ÷ £${r.p10!.toFixed(2)})</span></span>
      <span style="color:#8CA2BA;font-family:var(--font-sans)">Change ${years[0]}–${years[years.length - 1]}</span><span style="color:${dr > 0 ? '#E2A44E' : '#28B99D'}">${dr > 0 ? '+' : ''}${dr.toFixed(2)}×</span></div>
      <div style="margin-top:6px;color:#8CA2BA;font-size:10px">${SOURCE}${low ? '<br><span style="color:#E2A44E">Lower precision: CV above 20%</span>' : ''}</div>`
  }
  const showTip = (c: string, ev?: Event) => {
    const el = (ev?.currentTarget ?? null) as Element | null, hb = host.getBoundingClientRect(), cb = el?.getBoundingClientRect()
    if (!cb) return
    tip.html(tipHtml(c))
    const left = Math.min(cb.left - hb.left + cb.width + 8, hb.width - 250), top = Math.max(4, cb.top - hb.top - 10)
    tip.style('left', `${left}px`).style('top', `${top}px`).transition().duration(D(150)).style('opacity', 1)
  }
  const hideTip = () => tip.transition().duration(D(150)).style('opacity', 0)
  groups.on('pointerenter focus', function (ev, c) { showTip(c, ev) }).on('pointerleave blur', hideTip)
    .on('click', (_, c) => api.select(selected === c ? null : c)).on('keydown', (ev: KeyboardEvent, c) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); api.select(selected === c ? null : c) } })
    .attr('aria-label', c => `${c}, ${by(c, years[0]).nation}`)

  function render(ms: number) {
    const X = xz(), Y = yz()
    const xt = [2e5, 3e5, 5e5, 1e6, 2e6, 5e6, 1e7].filter(v => v >= X.domain()[0] && v <= X.domain()[1]), yt = Y.ticks(6)
    const T = <S extends d3.Selection<any, any, any, any>>(s: S) => (ms ? (s.transition().duration(ms).ease(d3.easeCubicOut) as unknown as S) : s)
    grid.selectAll('line.gx').data(xt).join('line').attr('class', 'gx').attr('y1', M.t).attr('y2', H - M.b).attr('stroke', '#1B344D').attr('stroke-opacity', 0.55).attr('stroke-dasharray', '2 4').attr('x1', d => X(d)).attr('x2', d => X(d))
    grid.selectAll('line.gy').data(yt).join('line').attr('class', 'gy').attr('x1', M.l).attr('x2', W - M.r).attr('stroke', '#1B344D').attr('stroke-opacity', 0.55).attr('stroke-dasharray', '2 4').attr('y1', d => Y(d)).attr('y2', d => Y(d))
    axes.selectAll('*').remove()
    axes.append('g').attr('transform', `translate(0 ${H - M.b})`).call(d3.axisBottom(X).tickValues(xt).tickFormat(d => k(d as number)).tickSizeOuter(0)).call(g => g.select('.domain').attr('stroke', '#1B344D')).call(g => g.selectAll('text').attr('fill', '#8CA2BA').attr('dy', '1.1em')).call(g => g.selectAll('line').attr('stroke', '#1B344D'))
    axes.append('g').attr('transform', `translate(${M.l} 0)`).call(d3.axisLeft(Y).tickValues(yt).tickFormat(d => `${(d as number).toFixed(1)}×`).tickSizeOuter(0)).call(g => g.select('.domain').attr('stroke', '#1B344D')).call(g => g.selectAll('text').attr('fill', '#8CA2BA')).call(g => g.selectAll('line').attr('stroke', '#1B344D'))
    yearMark.text(year)
    T(groups).attr('transform', c => { const r = by(c, year); return `translate(${X(r.population!)} ${Y(r.ratio!)})` })
      .style('opacity', c => (visible(c) ? 1 : 0.12))
    groups.style('pointer-events', c => (visible(c) ? 'all' : 'none'))
    groups.select('.ring').transition().duration(D(200)).attr('opacity', c => (c === selected ? 1 : 0))
    groups.select<SVGCircleElement>('circle:first-child').transition().duration(D(200)).attr('r', c => (c === selected ? 10 : 8))
    groups.select('text').transition().duration(D(250)).attr('fill', c => (c === selected ? '#BFE8FF' : '#F2F7FC')).attr('font-weight', c => (c === selected ? 600 : 400))
  }

  const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 8]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]])
    .filter(ev => ev.type !== 'wheel' || ev.ctrlKey || ev.metaKey) // plain scrolling keeps scrolling the page; Ctrl/⌘+wheel, pinch or drag zooms
    .on('zoom', ev => { transform = ev.transform; render(0) })
  svg.call(zoom)

  const api: Chart = {
    update(y) { if (!years.includes(y)) return; year = y; opts.onYear?.(y); hideTip(); render(D(750)) },
    setNations(n) { nations = n; render(D(250)) },
    setQuery(q) { query = q.trim(); render(D(250)) },
    select(c) {
      selected = c; opts.onSelect?.(c); render(0)
      if (c) { const r = by(c, year), t = d3.zoomIdentity.translate(W / 2, H / 2).scale(2).translate(-x0(r.population!), -y0(r.ratio!)); svg.transition().duration(D(750)).call(zoom.transform, t) }
      else api.resetZoom()
    },
    resetZoom() { svg.transition().duration(D(750)).call(zoom.transform, d3.zoomIdentity) },
    destroy() { svg.on('.zoom', null); host.replaceChildren() },
  }
  render(0)
  return api
}
