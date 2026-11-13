"""Extract mid-2016 population estimates by local authority from the ONS workbook.

Source : ONS, "Population Estimates for UK, England and Wales, Scotland and Northern Ireland:
         mid-2016" (ukmidyearestimates2016.xls), sheet MYE5.
Usage  : pip install xlrd && python -I scripts/build_population_data.py
Output : data/population-2016.json  (no values are estimated, filled or adjusted)
"""
import json
import xlrd

SRC = "data/source/ukmidyearestimates2016.xls"
OUT = "data/population-2016.json"
LA_PREFIXES = ("E06", "E07", "E08", "E09", "W06", "S12", "N09")  # unitary/district/borough/LGD codes
NATIONS = {"E": "England", "W": "Wales", "S": "Scotland", "N": "Northern Ireland"}

sheet = xlrd.open_workbook(SRC).sheet_by_name("MYE5")
header = sheet.row_values(4)
assert header[3].startswith("Estimated Population mid-2016"), header[:4]

areas = []
for r in range(5, sheet.nrows):
    code, name, area_km2, pop = sheet.row_values(r)[:4]
    if isinstance(code, str) and code[:3] in LA_PREFIXES and isinstance(pop, float):
        areas.append({"code": code, "name": name.strip(), "nation": NATIONS[code[0]],
                      "population": int(pop), "areaKm2": float(area_km2)})

areas.sort(key=lambda a: a["code"])
json.dump({
    "year": 2016,
    "reference": "Mid-2016 population estimate (30 June 2016), all ages, usual residents",
    "source": "Office for National Statistics, Population Estimates for UK, England and Wales, Scotland and Northern Ireland: mid-2016, sheet MYE5",
    "sourceUrl": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland",
    "licence": "Open Government Licence v3.0",
    "areas": areas,
}, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"{len(areas)} areas, UK total {sum(a['population'] for a in areas):,}")
