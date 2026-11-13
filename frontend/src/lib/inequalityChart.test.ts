import { readFileSync } from 'node:fs'
import { csvParse } from 'd3'
import { describe, expect, it } from 'vitest'
import { split, type Row } from './inequalityChart'

const n = (v: string) => (v === '' ? null : Number(v))
const rows: Row[] = csvParse(readFileSync('public/data/uk-cities-inequality.csv', 'utf8'), d => ({
  city: d.city!, nation: d.nation as Row['nation'], year: +d.year!, geography: d.geography!, population: n(d.population!), p10: n(d.p10!), p90: n(d.p90!),
  ratio: n(d.ratio!), cv_p10: n(d.cv_p10!), cv_p90: n(d.cv_p90!), status: d.status!, note: d.note!,
}))

describe('uk-cities-inequality.csv', () => {
  const s = split(rows)
  it('covers 2002 and 2015 only', () => expect(s.years).toEqual([2002, 2015]))
  it('plots only cities valid in both years', () => {
    expect(s.plotted.sort()).toEqual(['Birmingham', 'Bristol', 'Cardiff', 'Edinburgh', 'Glasgow', 'Leeds', 'Liverpool', 'London', 'Newcastle upon Tyne', 'Sheffield'])
  })
  it('reports suppressed and unpublished cities instead of plotting them', () => {
    const m = new Set(s.missing.map(r => r.city))
    for (const c of ['Belfast', 'Manchester', 'Aberdeen', 'Dundee', 'Nottingham']) expect(m.has(c)).toBe(true)
  })
  it('ratio equals published P90 / P10 and no US cities exist', () => {
    for (const r of rows.filter(r => r.status === 'ok')) expect(r.ratio).toBeCloseTo(r.p90! / r.p10!, 2)
    expect(rows.some(r => /new york|los angeles|chicago/i.test(r.city))).toBe(false)
  })
})
