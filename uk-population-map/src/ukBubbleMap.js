/**
 * Reusable UK population bubble map.
 *
 * Requires the globals `d3` (v7) and `topojson` (topojson-client v3).
 *
 *   const map = createUKBubbleMap(el, { topology, population, year: 2016 });
 *   map.setNation('Scotland');  map.select('S12000017');  map.resetView();
 *
 * Boundaries : ONSdigital/uk-topojson (areacd = GSS code, areanm, optional start/end years)
 * Population : any { areas: [{ code, name, nation, population, areaKm2 }] } keyed on the same GSS code.
 * Nothing is estimated: areas without a matching record are drawn as hatched "no data" outlines
 * and reported through `map.quality`.
 */
// Blue-only palette: nations differ by lightness (and are always named in text, never colour alone).
export const NATION_COLOURS = {
  England: '#69B8F0',
  Scotland: '#C5E9FF',
  Wales: '#3B82C4',
  'Northern Ireland': '#8FA7BF',
};
const NATION_BY_PREFIX = { E: 'England', S: 'Scotland', W: 'Wales', N: 'Northern Ireland' };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createUKBubbleMap(container, { topology, population, year = 2016, layer = 'ltla' }) {
  const root = d3.select(container);
  const fmt = d3.format(',');
  const dur = ms => (reducedMotion() ? 0 : ms);
  const listeners = { hover: () => {}, select: () => {}, zoom: () => {} };

  // ---- Data join on GSS codes ------------------------------------------------------------
  const nations = topojson.feature(topology, topology.objects.ctry);
  const inYear = f => (f.properties.start ?? -Infinity) <= year && (f.properties.end ?? Infinity) >= year;
  const areas = topojson.feature(topology, topology.objects[layer]).features.filter(inYear);
  const byCode = new Map(population.areas.map(a => [a.code, a]));
  const total = d3.sum(population.areas, a => a.population);

  /** Spherical centroid of the largest polygon, so island groups do not put a bubble in the sea. */
  const anchor = f => {
    const g = f.geometry;
    if (g.type === 'Polygon') return d3.geoCentroid(f);
    const parts = g.coordinates.map(c => ({ type: 'Polygon', coordinates: c }));
    return d3.geoCentroid(parts.reduce((best, p) => (d3.geoArea(p) > d3.geoArea(best) ? p : best)));
  };

  const rows = areas.map(f => {
    const rec = byCode.get(f.properties.areacd);
    return { feature: f, code: f.properties.areacd, name: f.properties.areanm, rec,
      nation: rec?.nation ?? NATION_BY_PREFIX[f.properties.areacd[0]], lonlat: anchor(f) };
  });
  const withData = rows.filter(r => r.rec).sort((a, b) => b.rec.population - a.rec.population);
  withData.forEach((r, i) => { r.rank = i + 1; });
  const noData = rows.filter(r => !r.rec);
  const boundaryCodes = new Set(rows.map(r => r.code));
  const quality = {
    boundaries: rows.length,
    matched: withData.length,
    unmatchedBoundaries: noData.map(r => ({ code: r.code, name: r.name })),
    populationWithoutBoundary: population.areas.filter(a => !boundaryCodes.has(a.code)).map(a => ({ code: a.code, name: a.name })),
    total,
  };

  // ---- SVG scaffold ----------------------------------------------------------------------
  root.classed('ukmap', true).selectAll('*').remove();
  const svg = root.append('svg').attr('class', 'ukmap__svg').attr('role', 'group')
    .attr('aria-label', `Bubble map of mid-${year} population by UK local authority. Use the search box or the list of largest areas for keyboard access.`);
  const defs = svg.append('defs');
  defs.append('pattern').attr('id', 'nodata-hatch').attr('width', 6).attr('height', 6)
    .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
    .append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 6).attr('class', 'ukmap__hatch');
  const glow = defs.append('filter').attr('id', 'bubble-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', 3);
  const viewport = svg.append('g').attr('class', 'ukmap__viewport');
  const gNations = viewport.append('g').attr('class', 'ukmap__nations');
  const gAreas = viewport.append('g').attr('class', 'ukmap__areas');
  const gBubbles = viewport.append('g').attr('class', 'ukmap__bubbles');
  const gRing = viewport.append('g').attr('class', 'ukmap__ring');
  const tooltip = root.append('div').attr('class', 'ukmap__tooltip').attr('role', 'status').style('opacity', 0);

  const projection = d3.geoMercator();
  const path = d3.geoPath(projection);
  const radius = d3.scaleSqrt().domain([0, d3.max(withData, r => r.rec.population)]).range([0, 40]);

  let width = 0, height = 0, k = 1, nation = 'All', selected = null, introDone = false;

  const nationPaths = gNations.selectAll('path').data(nations.features).join('path').attr('class', 'ukmap__nation');
  const areaPaths = gAreas.selectAll('path').data(rows, r => r.code).join('path')
    .attr('class', r => `ukmap__area${r.rec ? '' : ' ukmap__area--nodata'}`)
    .attr('fill', r => (r.rec ? 'none' : 'url(#nodata-hatch)'))
    .each(function (r) { if (!r.rec) d3.select(this).append('title').text(`${r.name} (${r.code}): no 2016 population record matched`); });
  const bubbles = gBubbles.selectAll('circle').data(withData, r => r.code).join('circle')
    .attr('class', 'ukmap__bubble').attr('fill', r => NATION_COLOURS[r.nation]).attr('stroke', r => NATION_COLOURS[r.nation])
    .attr('r', 0)
    .on('pointerenter pointermove', (event, r) => showTooltip(r, event))
    .on('pointerleave', () => { if (!selected) hideTooltip(); else showTooltip(selected); })
    .on('click', (event, r) => { event.stopPropagation(); select(r.code); });
  function clearSelection() {
    selected = null; gRing.selectAll('*').remove(); bubbles.classed('is-selected', false); areaPaths.classed('is-selected', false); hideTooltip();
  }
  svg.on('click', () => { clearSelection(); listeners.select(null); });

  // ---- Layout -----------------------------------------------------------------------------
  const zoom = d3.zoom().scaleExtent([1, 14]).on('zoom', ({ transform }) => {
    k = transform.k;
    viewport.attr('transform', transform);
    sizeBubbles();
    listeners.zoom(scaleInfo());
    if (selected) showTooltip(selected);
  });
  svg.call(zoom).on('dblclick.zoom', null);

  const baseR = r => radius(r.rec.population);
  const inFilter = r => nation === 'All' || r.nation === nation;
  // Bubbles grow slower than the map so zooming separates them; filtered-out bubbles shrink.
  const screenR = r => (baseR(r) / Math.sqrt(k)) * (inFilter(r) ? 1 : 0.55);
  function sizeBubbles() {
    bubbles.attr('r', screenR);
    areaPaths.attr('stroke-width', 0.6 / k);
    nationPaths.attr('stroke-width', 1 / k);
    gRing.selectAll('circle').attr('r', d => screenR(d) + 5 / k).attr('stroke-width', 2 / k);
  }
  const scaleInfo = () => ({ radius, k, max: radius.domain()[1] });

  function layout() {
    width = container.clientWidth;
    height = Math.max(440, Math.min(window.innerHeight * 0.86, width * 1.32));
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    const pad = Math.max(12, width * 0.03);
    projection.fitExtent([[pad, pad], [width - pad, height - pad]], nations);
    radius.range([0, Math.max(16, Math.min(46, Math.min(width, height) * 0.075))]);
    zoom.extent([[0, 0], [width, height]]).translateExtent([[-width * 0.2, -height * 0.2], [width * 1.2, height * 1.2]]);
    nationPaths.attr('d', path);
    areaPaths.attr('d', r => path(r.feature));
    bubbles.each(function (r) { const [x, y] = projection(r.lonlat); d3.select(this).attr('cx', x).attr('cy', y); });
    sizeBubbles();
    listeners.zoom(scaleInfo());
  }

  // ---- Interaction ------------------------------------------------------------------------
  function showTooltip(r, event) {
    const { rec } = r;
    const share = (rec.population / total) * 100;
    const density = rec.areaKm2 ? rec.population / rec.areaKm2 : null;
    tooltip.html(`
      <div class="tt__nation"><span class="tt__dot" style="background:${NATION_COLOURS[r.nation]}"></span>${r.nation}</div>
      <div class="tt__name">${r.name}</div>
      <div class="tt__pop">${fmt(rec.population)}<small> people, mid-${year}</small></div>
      <dl class="tt__meta">
        <div><dt>Rank</dt><dd>${r.rank} of ${withData.length}</dd></div>
        <div><dt>Share of UK</dt><dd>${share < 0.01 ? '<0.01' : share.toFixed(2)}%</dd></div>
        ${density ? `<div><dt>Density</dt><dd>${fmt(Math.round(density))}/km²</dd></div>` : ''}
        <div><dt>GSS code</dt><dd>${r.code}</dd></div>
      </dl>`);
    const box = container.getBoundingClientRect();
    let x, y;
    if (event && event.clientX !== undefined) { x = event.clientX - box.left; y = event.clientY - box.top; }
    else { const t = d3.zoomTransform(svg.node()); const [px, py] = projection(r.lonlat); x = t.applyX(px); y = t.applyY(py); }
    const tw = 240, th = 190;
    tooltip.style('left', `${Math.max(8, Math.min(width - tw - 8, x + 16))}px`)
      .style('top', `${Math.max(8, Math.min(height - th - 8, y + 16))}px`).style('opacity', 1);
    listeners.hover(r);
  }
  const hideTooltip = () => { tooltip.style('opacity', 0); listeners.hover(null); };

  function zoomToBounds(bounds, maxK = 14) {
    const [[x0, y0], [x1, y1]] = bounds;
    const s = Math.max(1, Math.min(maxK, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)));
    const t = d3.zoomIdentity.translate(width / 2 - (s * (x0 + x1)) / 2, height / 2 - (s * (y0 + y1)) / 2).scale(s);
    svg.transition().duration(dur(750)).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }

  function setNation(next) {
    nation = next;
    const on = r => next === 'All' || r.nation === next;
    bubbles.interrupt('filter').transition('filter').duration(dur(450)).ease(d3.easeCubicOut)
      .delay((r, i) => (on(r) ? dur(Math.min(i, 120) * 2) : 0))
      .style('opacity', r => (on(r) ? 1 : 0.06)).attr('r', screenR);
    bubbles.style('pointer-events', r => (on(r) ? 'all' : 'none'));
    nationPaths.classed('is-dim', f => next !== 'All' && NATION_BY_PREFIX[f.properties.areacd[0]] !== next);
    areaPaths.classed('is-dim', r => next !== 'All' && r.nation !== next);
    if (selected && !on(selected)) clearSelection();
    if (next === 'All') resetView();
    else zoomToBounds(path.bounds({ type: 'FeatureCollection', features: nations.features.filter(f => NATION_BY_PREFIX[f.properties.areacd[0]] === next) }), 8);
  }

  function select(code) {
    const r = withData.find(d => d.code === code);
    if (!r) return;
    if (nation !== 'All' && r.nation !== nation) setNation('All');
    selected = r;
    bubbles.classed('is-selected', d => d === r);
    areaPaths.classed('is-selected', d => d === r);
    const [x, y] = projection(r.lonlat);
    gRing.selectAll('*').remove();
    gRing.append('circle').datum(r).attr('class', 'ukmap__select').attr('cx', x).attr('cy', y)
      .attr('r', screenR(r) + 5 / k).attr('stroke-width', 2 / k);
    const s = Math.max(k, 4);
    svg.transition().duration(dur(800)).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity.translate(width / 2 - s * x, height / 2 - s * y).scale(s))
      .on('end', () => showTooltip(r));
    listeners.select(r);
  }

  const resetView = () => svg.transition().duration(dur(650)).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity);
  const zoomBy = f => svg.transition().duration(dur(250)).call(zoom.scaleBy, f);

  /** One-off entrance: bubbles bloom from 0, largest first, with a short stagger. */
  function intro() {
    if (introDone) return;
    introDone = true;
    bubbles.style('opacity', 1).attr('r', 0)
      .transition('intro').duration(dur(700)).delay((_, i) => dur(i * 3)).ease(d3.easeBackOut.overshoot(1.1)).attr('r', screenR);
  }

  layout();
  intro();
  const ro = new ResizeObserver(() => { if (container.clientWidth !== width) { layout(); hideTooltip(); } });
  ro.observe(container);

  return {
    quality, total, year,
    areas: withData.map(r => ({ code: r.code, name: r.name, nation: r.nation, population: r.rec.population, rank: r.rank })),
    radius: () => radius, scale: scaleInfo,
    setNation, select, resetView, zoomIn: () => zoomBy(1.6), zoomOut: () => zoomBy(1 / 1.6),
    on(type, fn) { listeners[type] = fn; return this; },
    destroy() { ro.disconnect(); root.selectAll('*').remove(); },
  };
}
