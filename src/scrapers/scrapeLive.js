/**
 * Scrapes live stock data with detailed company information
 * Combines live prices, circuit breaker limits, and company fundamentals
 * @returns {Promise<Array>} Array containing stocks array in format [{ stocks: [...] }]
 */

const axios = require('axios');
const cheerio = require('cheerio');
const getStockInfo = require('./getStockInfo');
const parseCBUL = require('./parseCBUL');

async function scrapeLive() {
  try {
    // Fetch live prices and circuit breaker data in parallel
    const [dsexResp, cbulResp] = await Promise.all([
      axios.get('https://www.dsebd.org/latest_share_price_scroll_l.php'),
      axios.get('https://www.dsebd.org/cbul.php'),
    ]);

    // Parse live stock price data
    const stocks = [];
    const $ = cheerio.load(dsexResp.data);
    $('table.table-bordered tbody tr').each((i, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 11) {
        const code = $(tds[1]).text().trim();

        stocks.push({
          code,
          ltp: $(tds[2]).text().trim(),
          high: $(tds[3]).text().trim(),
          low: $(tds[4]).text().trim(),
          close: parseFloat($(tds[5]).text()),
          ycp: parseFloat($(tds[6]).text()),
          change: parseFloat($(tds[7]).text()),
          trade: parseFloat($(tds[8]).text()),
          value_mn: parseFloat($(tds[9]).text()),
          volume: parseInt($(tds[10]).text().replace(/,/g, '')),
          lowerLimit: null,
          upperLimit: null,
          breakerPercent: null,
          refFloor: null
        });
      }
    });

    // Merge circuit breaker limits into stock data
    const cbulMap = parseCBUL(cbulResp.data);
    for (const stock of stocks) {
      if (cbulMap[stock.code]) {
        Object.assign(stock, cbulMap[stock.code]);
      }
    }

    // Fetch detailed company info for each stock (EPS, NAV, dividends, etc.)
    await Promise.all(
      stocks.map(async (stock) => {
        const info = await getStockInfo(stock.code);
        Object.assign(stock, info);
      })
    );

    return [{ stocks }];
  } catch (error) {
    console.error('[scrapeLive] Error:', error.message);
    return [{ stocks: [] }];
  }
}

module.exports = scrapeLive;
