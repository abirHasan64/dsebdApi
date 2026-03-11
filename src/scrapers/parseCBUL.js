/**
 * Parses Circuit Breaker Upper/Lower price limits from DSE CBUL page
 * @param {string} html - HTML content of CBUL page
 * @returns {Object} Map of stock codes to their circuit breaker limits
 */

const cheerio = require("cheerio");

function parseCBUL(html) {
  const $ = cheerio.load(html);
  const map = {};

  // Extract circuit breaker info from table rows
  $("table.table-bordered tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 8) {
      const code = $(tds[1]).text().trim();
      map[code] = {
        breakerPercent: parseFloat($(tds[2]).text().trim().replace('%', '')) || null,
        refFloor: parseFloat($(tds[5]).text().trim().replace(/,/g, '')) || null,
        lowerLimit: parseFloat($(tds[6]).text().trim().replace(/,/g, '')) || null,
        upperLimit: parseFloat($(tds[7]).text().trim().replace(/,/g, '')) || null
      };
    }
  });

  return map;
}

module.exports = parseCBUL;
