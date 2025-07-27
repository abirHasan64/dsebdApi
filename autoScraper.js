const scrapeLive = require('./src/scrapers/scrapeLive');
const scrapeDSE30 = require('./src/scrapers/scrapeDSE30');
const scrapeTop20 = require('./src/scrapers/scrapeTop20');
const { connectDB } = require('./src/db');
const cron = require('node-cron'); // Keep it if you plan to use cron scheduling later

// Self-invoking async function to test scrapeDSE30 on startup
(async () => {
  try {
    const dse30 = await scrapeDSE30();
  } catch (error) {
    console.error('Error testing scrapeDSE30:', error.message);
  }
})();

/**
 * Save data cache to MongoDB collection `${type}_cache`.
 * Replaces existing cache document with upsert.
 * @param {string} type - Cache type (e.g., 'live', 'dse30', 'top20')
 * @param {any} data - Data to be cached
 */
async function saveCache(type, data) {
  const db = await connectDB();
  const collection = db.collection(`${type}_cache`);

  await collection.updateOne(
    { type },
    {
      $set: {
        type,
        data,
        timestamp: new Date() // Store UTC server time
      }
    },
    { upsert: true }
  );

  console.log(`[${type}] Cache saved (${Array.isArray(data) ? data.length : 1} items)`);
}

/**
 * Scrape all data sources and save caches.
 * Runs all scrapes concurrently, then saves caches concurrently.
 */
async function scrapeAndSaveAll() {
  try {
    const liveRaw = await scrapeLive();
    const live = liveRaw[0]?.stocks || [];

    // Scrape DSE30 and Top20 concurrently
    const [dse30, top20] = await Promise.all([
      scrapeDSE30(),
      scrapeTop20()
    ]);

    // Save all caches concurrently
    await Promise.all([
      saveCache('live', live),
      saveCache('dse30', dse30),
      saveCache('top20', top20)
    ]);
  } catch (error) {
    console.error('Error during scraping:', error.message);
  }
}

// Run scraping once immediately on startup
scrapeAndSaveAll();

// Schedule scraping every 60 seconds (can switch to cron later if preferred)
setInterval(scrapeAndSaveAll, 60 * 1000);

