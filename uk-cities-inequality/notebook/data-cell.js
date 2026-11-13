data = FileAttachment("uk-cities-inequality.csv")
  .csv(d3.autoType)
  .then(rows => {
    const ukNations = new Set([
      "England",
      "Scotland",
      "Wales",
      "Northern Ireland"
    ]);

    return rows
      .filter(d => ukNations.has(d.nation))
      .map(d => ({
        city: d.city,
        nation: d.nation,
        nyt_display: d.city,
        highlight: d.highlight === 1,

        POP_2001: d.population_2001,
        POP_2015: d.population_2015,

        R90_10_2001:
          d.p90_2001 / d.p10_2001,

        R90_10_2015:
          d.p90_2015 / d.p10_2015
      }))
      .filter(d =>
        [d.POP_2001, d.POP_2015,
         d.R90_10_2001, d.R90_10_2015]
          .every(Number.isFinite) &&
        d.POP_2001 > 0 &&
        d.POP_2015 > 0 &&
        d.R90_10_2001 > 0 &&
        d.R90_10_2015 > 0
      );
  });
