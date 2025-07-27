const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeDSE30() {
  try {
    const res = await axios.get('https://www.dsebd.org/dse30_share.php');
    const $ = cheerio.load(res.data);
    const shares = [];

    $('table.table-bordered tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length > 1) {
        shares.push({
          code: $(tds[1]).text().trim(),
          ltp: $(tds[2]).text().trim(),
          high: $(tds[3]).text().trim(),
          low: $(tds[4]).text().trim(),
          close: $(tds[5]).text().trim(),
          ycp: $(tds[6]).text().trim(),
          percent_change: $(tds[7]).text().trim(),
          trade: $(tds[8]).text().trim(),
          value_mn: $(tds[9]).text().trim(),
          volume: $(tds[10]).text().trim(),
        });
      }
    });

    return shares;
  } catch (error) {
    console.error('Error in scrapeDSE30:', error);
    return [];
  }
}

module.exports = scrapeDSE30;