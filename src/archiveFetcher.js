// const axios = require('axios');
// const cheerio = require('cheerio');

// async function scrapeArchiveFromWeb(startDate, endDate) {
//   const url = `https://www.dsebd.org/day_end_archive.php?startDate=${startDate}&endDate=${endDate}&inst=All%20Instrument&archive=data`;
  
//   const resp = await axios.get(url);
//   const $ = cheerio.load(resp.data);

//   const rows = [];
//   $('table.table tbody tr').each((i, tr) => {
//     const tds = $(tr).find('td');
//     if (tds.length >= 12) {
//       rows.push({
//         date: $(tds[1]).text().trim(),
//         code: $(tds[2]).text().trim(),
//         ltp: parseFloat($(tds[3]).text().replace(/,/g, '')),
//         high: parseFloat($(tds[4]).text().replace(/,/g, '')),
//         low: parseFloat($(tds[5]).text().replace(/,/g, '')),
//         open: parseFloat($(tds[6]).text().replace(/,/g, '')),
//         close: parseFloat($(tds[7]).text().replace(/,/g, '')),
//         ycp: parseFloat($(tds[8]).text().replace(/,/g, '')),
//         trades: parseInt($(tds[9]).text().replace(/,/g, '')),
//         value: parseFloat($(tds[10]).text().replace(/,/g, '')),
//         volume: parseInt($(tds[11]).text().replace(/,/g, ''))
//       });
//     }
//   });
//   return rows;
// }

// module.exports = { scrapeArchiveFromWeb };
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeArchiveFromWeb(startDate, endDate) {
  console.log(`Fetching archive from ${startDate} to ${endDate}`);
  const url = `https://www.dsebd.org/day_end_archive.php?startDate=${startDate}&endDate=${endDate}&inst=All%20Instrument&archive=data`;

  try {
    const resp = await axios.get(url);

    // Optional: uncomment to debug raw HTML
    // require('fs').writeFileSync('archive_raw.html', resp.data);

    const $ = cheerio.load(resp.data);
    const rows = [];

    $('table.table tbody tr').each((i, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 12) {
        const dateStr = $(tds[1]).text().trim();
        const code = $(tds[2]).text().trim();
        // parse floats safely with fallback
        const safeParseFloat = (str) => {
          const n = parseFloat(str.replace(/,/g, ''));
          return isNaN(n) ? null : n;
        };
        const safeParseInt = (str) => {
          const n = parseInt(str.replace(/,/g, ''), 10);
          return isNaN(n) ? null : n;
        };

        rows.push({
          date: dateStr,
          code,
          ltp: safeParseFloat($(tds[3]).text()),
          high: safeParseFloat($(tds[4]).text()),
          low: safeParseFloat($(tds[5]).text()),
          open: safeParseFloat($(tds[6]).text()),
          close: safeParseFloat($(tds[7]).text()),
          ycp: safeParseFloat($(tds[8]).text()),
          trades: safeParseInt($(tds[9]).text()),
          value: safeParseFloat($(tds[10]).text()),
          volume: safeParseInt($(tds[11]).text())
        });
      }
    });

    console.log(`Found ${rows.length} rows in archive`);
    return rows;
  } catch (error) {
    console.error('Error fetching archive:', error.message);
    throw error;
  }
}

module.exports = { scrapeArchiveFromWeb };
