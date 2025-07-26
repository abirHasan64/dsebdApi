const scrapeLive = require('./scrapers/scrapeLive');
const scrapeTop20 = require('./scrapers/scrapeTop20');
const scrapeDSE30 = require('./scrapers/scrapeDSE30');

module.exports = {
  scrapeLive,
  scrapeTop20,
  scrapeDSE30
};
