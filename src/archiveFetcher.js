const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeArchiveFromWeb(startDate, endDate) {
  const url = `https://www.dsebd.org/day_end_archive.php?startDate=${startDate}&endDate=${endDate}&inst=All%20Instrument&archive=data`;
  
  const resp = await axios.get(url);
  const $ = cheerio.load(resp.data);

  const rows = [];
  $('table.table tbody tr').each((i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 12) {
      rows.push({
        date: $(tds[1]).text().trim(),
        code: $(tds[2]).text().trim(),
        ltp: parseFloat($(tds[3]).text().replace(/,/g, '')),
        high: parseFloat($(tds[4]).text().replace(/,/g, '')),
        low: parseFloat($(tds[5]).text().replace(/,/g, '')),
        open: parseFloat($(tds[6]).text().replace(/,/g, '')),
        close: parseFloat($(tds[7]).text().replace(/,/g, '')),
        ycp: parseFloat($(tds[8]).text().replace(/,/g, '')),
        trades: parseInt($(tds[9]).text().replace(/,/g, '')),
        value: parseFloat($(tds[10]).text().replace(/,/g, '')),
        volume: parseInt($(tds[11]).text().replace(/,/g, ''))
      });
    }
  });
  return rows;
}

module.exports = { scrapeArchiveFromWeb };

