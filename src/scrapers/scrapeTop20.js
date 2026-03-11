/**
 * Scrapes Top 20 shares by trading volume/value
 * @returns {Promise<Array>} Array of top 20 stock data objects
 */

const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeTop20() {
  try {
    const res = await axios.get('https://www.dsebd.org/top_20_share.php');
    const $ = cheerio.load(res.data);
    const shares = [];

    // Parse table rows and extract stock data
    $('table.table-bordered tbody tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length > 1) {
        shares.push({
          code: $(tds[1]).text().trim(),
          ltp: $(tds[2]).text().trim(),
          high: $(tds[3]).text().trim(),
          low: $(tds[4]).text().trim(),
          ycp: $(tds[5]).text().trim(),
          close: $(tds[6]).text().trim(),
          trade: $(tds[7]).text().trim(),
          value_mn: $(tds[8]).text().trim(),
          volume: $(tds[9]).text().trim(),
        });
      }
    });

    return shares;
  } catch (error) {
    console.error('[scrapeTop20] Error:', error);
    return [];
  }
}

module.exports = scrapeTop20;
