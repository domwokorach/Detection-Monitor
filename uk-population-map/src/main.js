import { createUKBubbleMap, NATION_COLOURS } from './ukBubbleMap.js';

const $ = id => document.getElementById(id);
const fmt = d3.format(',');
const NATIONS = ['All', 'England', 'Scotland', 'Wales', 'Northern Ireland'];

async function boot() {
  let topology, population;
  try {
    [topology, population] = await Promise.all([
      d3.json('data/topo.json'), d3.json('data/population-2016.json'),
    ]);
  } catch (err) {
    $('status').textContent = 'Could not load the data files. Serve this folder over HTTP (see README), then reload.';
    $('status').classList.add('status--error');
    throw err;
  }

  const map = createUKBubbleMap($('map'), { topology, population, year: 2016 });
  $('status').textContent = '';
  $('status').hidden = true;
  let nation = 'All';

  // ---- Nation chips ---------------------------------------------------------------------
  const nationTotals = n => map.areas.filter(a => n === 'All' || a.nation === n);
  d3.select('#nations').selectAll('button').data(NATIONS).join('button')
    .attr('type', 'button').attr('class', 'chip').attr('aria-pressed', n => n === 'All')
    .style('--c', n => NATION_COLOURS[n] ?? '#e6e9f2')
    .html(n => `<span class="chip__dot"></span>${n}<small>${nationTotals(n).length}</small>`)
    .on('click', (_, n) => {
      nation = n;
      d3.selectAll('#nations .chip').attr('aria-pressed', d => d === n);
      map.setNation(n);
      renderStats(); renderTop();
    });

  // Animated KPI counter (instant under prefers-reduced-motion)
  function countTo(el, to) {
    const from = +el.dataset.value || 0;
    el.dataset.value = to;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    d3.select(el).interrupt().transition().duration(900).ease(d3.easeCubicOut)
      .tween('count', () => { const i = d3.interpolateRound(from, to); return t => { el.textContent = fmt(i(t)); }; });
  }

  // ---- Collapsible side panel ----------------------------------------------------------
  const toggle = $('panel-toggle'), layout = document.querySelector('.layout');
  toggle.addEventListener('click', () => {
    const collapsed = layout.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.querySelector('span').textContent = collapsed ? 'Show panel' : 'Hide panel';
  });

  // ---- Stats & top list -----------------------------------------------------------------
  function renderStats() {
    const rows = nationTotals(nation);
    const sum = d3.sum(rows, r => r.population);
    $('stats-label').textContent = nation === 'All' ? 'United Kingdom' : nation;
    countTo($('stats-value'), sum);
    $('stats-sub').textContent = `${rows.length} local authorities · ${((sum / map.total) * 100).toFixed(1)}% of the UK`;
  }
  function renderTop() {
    $('top-scope').textContent = nation === 'All' ? 'in the UK' : `in ${nation}`;
    const rows = nationTotals(nation).slice(0, 8);
    const max = rows[0]?.population ?? 1;
    d3.select('#top').selectAll('li').data(rows, d => d.code).join('li')
      .html(d => `<button type="button" class="top__row">
          <span class="top__name">${d.name}</span><span class="top__pop">${fmt(d.population)}</span>
          <span class="top__bar" style="--w:${(d.population / max) * 100}%;--c:${NATION_COLOURS[d.nation]}"></span></button>`)
      .select('button').on('click', (_, d) => map.select(d.code));
  }
  renderStats(); renderTop();

  // ---- Legend (drawn in screen pixels, follows zoom) ------------------------------------
  const legend = d3.select('#legend');
  function renderLegend({ radius, k, max }) {
    const stops = [1e5, 5e5, 1e6].filter(v => v <= max * 1.02);
    const f = Math.sqrt(k); // on-screen radius = base radius × √k
    const rs = stops.map(v => radius(v) * f);
    const h = Math.max(...rs) * 2 + 10, w = 260;
    legend.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const cx = Math.max(...rs) + 6;
    legend.selectAll('g').data(stops).join(enter => {
      const g = enter.append('g'); g.append('circle'); g.append('line'); g.append('text'); return g;
    }).each(function (v, i) {
      const g = d3.select(this), r = rs[i], base = h - 5;
      g.select('circle').attr('cx', cx).attr('cy', base - r).attr('r', r).attr('class', 'legend__c');
      g.select('line').attr('x1', cx).attr('y1', base - 2 * r).attr('x2', cx + Math.max(...rs) + 24).attr('y2', base - 2 * r).attr('class', 'legend__l');
      g.select('text').attr('x', cx + Math.max(...rs) + 30).attr('y', base - 2 * r + 4).attr('class', 'legend__t').text(`${d3.format('.1s')(v).replace('1.0M', '1M')} people`.replace('100k', '100k'));
    });
  }
  map.on('zoom', renderLegend);
  renderLegend(map.scale());

  // ---- Search (ARIA combobox) -----------------------------------------------------------
  const input = $('search'), list = $('results');
  let matches = [], active = -1;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function renderResults() {
    list.hidden = !matches.length && !input.value.trim();
    d3.select(list).selectAll('li').data(matches, d => d.code).join('li')
      .attr('role', 'option').attr('id', d => `opt-${d.code}`).attr('aria-selected', (_, i) => i === active)
      .html(d => `<span>${d.name}</span><small>${d.nation} · ${fmt(d.population)}</small>`)
      .on('pointerdown', (e, d) => { e.preventDefault(); choose(d); });
    if (!matches.length && input.value.trim()) list.innerHTML = '<li class="empty" role="option" aria-disabled="true">No local authority matches</li>';
    input.setAttribute('aria-expanded', String(!list.hidden));
    input.setAttribute('aria-activedescendant', active >= 0 ? `opt-${matches[active].code}` : '');
  }
  function choose(d) { input.value = d.name; matches = []; active = -1; renderResults(); list.hidden = true; map.select(d.code); }
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    matches = q ? map.areas.filter(a => norm(a.name).includes(q)).slice(0, 8) : [];
    active = matches.length ? 0 : -1; renderResults();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && matches.length) { active = (active + 1) % matches.length; e.preventDefault(); }
    else if (e.key === 'ArrowUp' && matches.length) { active = (active - 1 + matches.length) % matches.length; e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active]) { choose(matches[active]); return; }
    else if (e.key === 'Escape') { matches = []; active = -1; input.value = ''; list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    renderResults();
  });
  input.addEventListener('blur', () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); });

  // ---- Zoom buttons ---------------------------------------------------------------------
  $('zoom-in').onclick = map.zoomIn; $('zoom-out').onclick = map.zoomOut; $('zoom-reset').onclick = map.resetView;

  // ---- Data quality ---------------------------------------------------------------------
  const q = map.quality;
  const nd = q.unmatchedBoundaries, orphan = q.populationWithoutBoundary;
  $('quality-text').innerHTML =
    `<strong>${q.matched}</strong> of <strong>${q.boundaries}</strong> boundaries valid in 2016 matched an ONS population record; the total is <strong>${fmt(q.total)}</strong>.` +
    (nd.length ? ` <strong>No data for ${nd.length}:</strong> ${nd.map(a => `${a.name} (${a.code})`).join(', ')}.` : ' No boundaries are missing a population figure.') +
    (orphan.length ? ` Population records with no boundary: ${orphan.map(a => `${a.name} (${a.code})`).join(', ')}.` : ' No population records are missing a boundary.');
}

boot();
