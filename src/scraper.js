/**
 * Main scraper module - bundles all individual scraper functions
 * Exports functions for scraping live stocks, DSE30, and Top20 data
 */

const scrapeLive = require('./scrapers/scrapeLive');
const scrapeTop20 = require('./scrapers/scrapeTop20');
const scrapeDSE30 = require('./scrapers/scrapeDSE30');

module.exports = {
  scrapeLive,
  scrapeTop20,
  scrapeDSE30
};
