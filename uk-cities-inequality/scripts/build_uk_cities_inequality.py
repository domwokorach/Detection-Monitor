"""Build data/uk-cities-inequality.csv from ONS ASHE Table 8.5 (hourly pay, gross, all employees, place of residence)
and ONS mid-year population estimates (Nomis NM_2002_1). Values are copied as published; nothing is estimated.

Run (needs xlrd):  python3 scripts/build_uk_cities_inequality.py
"""
import csv, re, xlrd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'data' / 'source', ROOT / 'data' / 'uk-cities-inequality.csv'
YEARS = (2002, 2015)

# city -> (nation, ASHE row name per year, population geography name). A city is ONE published area, never an average of several.
# London is a published region (Greater London); every other city is its single local authority.
CITIES = {
    'London': ('England', {2002: 'London', 2015: 'London'}, 'region:London', 'Greater London (region)'),
    'Birmingham': ('England', {2002: 'Birmingham', 2015: 'Birmingham'}, 'la:Birmingham', 'Birmingham LA'),
    'Manchester': ('England', {2002: 'Manchester', 2015: 'Manchester'}, 'la:Manchester', 'Manchester LA'),
    'Liverpool': ('England', {2002: 'Liverpool', 2015: 'Liverpool'}, 'la:Liverpool', 'Liverpool LA'),
    'Leeds': ('England', {2002: 'Leeds', 2015: 'Leeds'}, 'la:Leeds', 'Leeds LA'),
    'Sheffield': ('England', {2002: 'Sheffield', 2015: 'Sheffield'}, 'la:Sheffield', 'Sheffield LA'),
    'Bristol': ('England', {2002: 'Bristol, City of UA', 2015: 'Bristol, City of UA'}, 'la:Bristol, City of', 'Bristol LA'),
    'Newcastle upon Tyne': ('England', {2002: 'Newcastle upon Tyne', 2015: 'Newcastle upon Tyne'}, 'la:Newcastle upon Tyne', 'Newcastle upon Tyne LA'),
    'Nottingham': ('England', {2002: 'Nottingham UA', 2015: 'Nottingham UA'}, 'la:Nottingham', 'Nottingham LA'),
    'Leicester': ('England', {2002: 'Leicester UA', 2015: 'Leicester UA'}, 'la:Leicester', 'Leicester LA'),
    'Coventry': ('England', {2002: 'Coventry', 2015: 'Coventry'}, 'la:Coventry', 'Coventry LA'),
    'Cardiff': ('Wales', {2002: 'Cardiff', 2015: 'Cardiff / Caerdydd'}, 'la:Cardiff', 'Cardiff LA'),
    'Swansea': ('Wales', {2002: 'Swansea', 2015: 'Swansea / Abertawe'}, 'la:Swansea', 'Swansea LA'),
    'Glasgow': ('Scotland', {2002: 'Glasgow City', 2015: 'Glasgow City'}, 'la:Glasgow City', 'Glasgow City LA'),
    'Edinburgh': ('Scotland', {2002: 'Edinburgh, City of', 2015: 'City of Edinburgh'}, 'la:City of Edinburgh', 'City of Edinburgh LA'),
    'Aberdeen': ('Scotland', {2002: 'Aberdeen City', 2015: 'Aberdeen City'}, 'la:Aberdeen City', 'Aberdeen City LA'),
    'Dundee': ('Scotland', {2002: 'Dundee City', 2015: 'Dundee City'}, 'la:Dundee City', 'Dundee City LA'),
    'Belfast': ('Northern Ireland', {}, 'la:Belfast', 'Belfast LGD'),  # Northern Ireland is not covered by ASHE Table 8
}

def sheet(path):
    return xlrd.open_workbook(path).sheet_by_name('All')

def find(sh, name):
    rows = [r for r in range(sh.nrows) if str(sh.cell_value(r, 0)).strip() == name]
    return rows[0] if len(rows) == 1 else None  # ambiguous or absent -> missing, never guessed

def num(v):
    return float(v) if isinstance(v, (int, float)) else None  # 'x', '..', '' = suppressed / unavailable

def population():
    pop = {}
    for f, kind in (('nomis-population-la-2002-2015.csv', 'la'), ('nomis-population-regions-2002-2015.csv', 'region')):
        for r in csv.DictReader(open(SRC / f)):
            pop[(f'{kind}:{r["GEOGRAPHY_NAME"]}', int(r['DATE_NAME']))] = int(r['OBS_VALUE'])
    return pop

def main():
    pop = population()
    rows = []
    for year in YEARS:
        val = sheet(SRC / f'ashe-table-8.5a-{year}.xls'); cv = sheet(SRC / f'ashe-table-8.5b-{year}-cv.xls')
        for city, (nation, names, popkey, geo) in CITIES.items():
            p = pop.get((popkey, year))
            r = find(val, names[year]) if year in names else None
            rec = dict(city=city, nation=nation, year=year, geography=geo, population=p or '', p10='', p90='', ratio='', cv_p10='', cv_p90='', status='', note='')
            if r is None:
                rec.update(status='not_published', note='Not covered by ASHE Table 8 (place of residence)' if city == 'Belfast' else 'No matching row')
            else:
                p10, p90 = num(val.cell_value(r, 7)), num(val.cell_value(r, 16))
                if p10 and p90:
                    rec.update(p10=p10, p90=p90, ratio=round(p90 / p10, 3), cv_p10=num(cv.cell_value(r, 7)) or '', cv_p90=num(cv.cell_value(r, 16)) or '', status='ok')
                else:
                    rec.update(status='suppressed', note='ONS suppressed %s (x)' % ('P90' if not p90 else 'P10'))
            if p is None: rec.update(status='no_population', ratio='', note='No population estimate')
            rows.append(rec)
    with open(OUT, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    both = [c for c in CITIES if all(x['status'] == 'ok' for x in rows if x['city'] == c)]
    print(f'wrote {OUT} - {len(both)}/{len(CITIES)} cities have valid data in both years:', ', '.join(both))
    for x in rows:
        if x['status'] != 'ok': print(f'  missing {x["city"]} {x["year"]}: {x["status"]} {x["note"]}')

if __name__ == '__main__':
    main()
