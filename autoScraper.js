const axios = require('axios');
const scrapeLive = require('./src/scrapers/scrapeLive');
const scrapeDSE30 = require('./src/scrapers/scrapeDSE30');
const scrapeTop20 = require('./src/scrapers/scrapeTop20');
const scrapeIndicesFromHomepage = require('./src/scrapers/scrapeIndicesFromHomepage');
const { scrapeArchiveFromWeb } = require('./src/archiveFetcher');
const { connectDB } = require('./src/db');
const cron = require('node-cron');
const scrapeNews = require('./src/scrapers/scrapeNews');

/**
 * Saves scraped data to MongoDB cache collection
 * @param {string} type - Cache type (e.g., 'live', 'dse30', 'top20', 'indices')
 * @param {Array|Object} data - Data to cache
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
        timestamp: new Date()
      }
    },
    { upsert: true }
  );

  console.log(`[${type}] Cache saved (${Array.isArray(data) ? data.length : 1} items)`);
}

/**
 * Scrapes and caches live stock data, DSE30, and Top20 shares
 */
async function scrapeAndSaveAll() {
  try {
    const liveRaw = await scrapeLive();
    const live = liveRaw[0]?.stocks || [];

    const [dse30, top20] = await Promise.all([
      scrapeDSE30(),
      scrapeTop20()
    ]);

    await Promise.all([
      saveCache('live', live),
      saveCache('dse30', dse30),
      saveCache('top20', top20)
    ]);
  } catch (error) {
    console.error('[scraper] Error during scraping:', error.message);
  }
}

/**
 * Scrapes and caches market indices data
 */
async function scrapeAndSaveIndices() {
  try {
    const homepageResp = await axios.get('https://www.dsebd.org/');
    const indices = await scrapeIndicesFromHomepage(homepageResp.data);
    await saveCache('indices', indices);
  } catch (error) {
    console.error('[indices] Error during scraping:', error.message);
  }
}

// Initialize scraping on startup
scrapeAndSaveAll();
scrapeAndSaveIndices();

// Schedule live/DSE30/Top20 scraping every 60 seconds
setInterval(scrapeAndSaveAll, 60 * 1000);

// Schedule indices scraping every 60 seconds
setInterval(scrapeAndSaveIndices, 60 * 1000);

/**
 * Calculates the date to scrape based on Bangladesh timezone
 * Returns today if after 4 PM BD time, otherwise returns yesterday
 * Format: YYYY-MM-DD
 */
function getScrapeDate() {
  const now = new Date();

  // Convert to BD timezone (UTC+6)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (6 * 3600000));

  // After 4 PM BD time: scrape today, otherwise scrape yesterday
  if (bdTime.getHours() >= 16) {
    return bdTime.toISOString().slice(0, 10);
  } else {
    bdTime.setDate(bdTime.getDate() - 1);
    return bdTime.toISOString().slice(0, 10);
  }
}

// Archive scraper: Daily at 6 PM BD time (12 PM UTC)
cron.schedule('0 12 * * *', async () => {
  const startDate = getScrapeDate();
  const endDate = startDate;

  try {
    console.log(`[archive] Starting scrape for ${startDate}...`);

    const data = await scrapeArchiveFromWeb(startDate, endDate);

    if (data.length > 0) {
      const db = await connectDB();
      const col = db.collection('history');

      const operations = data.map(doc => ({
        updateOne: {
          filter: { date: doc.date, code: doc.code },
          update: { $set: doc },
          upsert: true
        }
      }));

      await col.bulkWrite(operations);
      console.log(`[archive] ${data.length} items saved for ${startDate}`);
    } else {
      console.log(`[archive] No data found for ${startDate}`);
    }
  } catch (err) {
    console.error('[archive] Error:', err.message);
  }
});

// News scraper: Hourly at the start of each hour
cron.schedule('0 * * * *', async () => {
  try {
    await scrapeNews();
    console.log('[news] Scraping completed successfully.');
  } catch (error) {
    console.error('[news] Scraping failed:', error.message);
  }
});


