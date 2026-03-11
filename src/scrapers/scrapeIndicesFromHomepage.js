/**
 * Scrapes market indices and trading statistics from DSE homepage
 * Extracts DSE General Index, DSE30, DSE Broad, and market statistics
 * @param {string} html - HTML content of DSE homepage
 * @returns {Promise<Array>} Array of indices and market statistics objects
 */

const cheerio = require('cheerio');

async function scrapeIndicesFromHomepage(html) {
  const $ = cheerio.load(html);
  const rows = $('.LeftColHome .midrow');
  const data = [];

  // Extract the three main indices (DSE General, DSE30, DSE Broad)
  for (let i = 0; i < 3; i++) {
    const row = $(rows[i]);
    data.push({
      index: row.find('.m_col-1').text().trim().replace(/\s+/g, ' '),
      value: parseFloat(row.find('.m_col-2').text().trim()),
      change: parseFloat(row.find('.m_col-3').text().trim()),
      changePercent: row.find('.m_col-4').text().trim()
    });
  }

  // Extract trading statistics and market movement summary
  const tradeRow = $(rows[4]);
  const issuesRow = $(rows[6]);
  data.push(
    { totalTrade: parseInt(tradeRow.find('.m_col-wid').text().replace(/,/g, '').trim()) || null },
    { totalVolume: parseInt(tradeRow.find('.m_col-wid1').text().replace(/,/g, '').trim()) || null },
    { totalValue_mn: parseFloat(tradeRow.find('.m_col-wid2').text().replace(/,/g, '').trim()) || null },
    { issuesAdvanced: parseInt(issuesRow.find('.m_col-wid').text().replace(/,/g, '').trim()) || null },
    { issuesDeclined: parseInt(issuesRow.find('.m_col-wid1').text().replace(/,/g, '').trim()) || null },
    { issuesUnchanged: parseInt(issuesRow.find('.m_col-wid2').text().replace(/,/g, '').trim()) || null }
  );

  return data;
}

module.exports = scrapeIndicesFromHomepage;
