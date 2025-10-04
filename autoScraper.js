const axios = require('axios');
const scrapeLive = require('./src/scrapers/scrapeLive');
const scrapeDSE30 = require('./src/scrapers/scrapeDSE30');
const scrapeTop20 = require('./src/scrapers/scrapeTop20');
const scrapeIndicesFromHomepage = require('./src/scrapers/scrapeIndicesFromHomepage');
const { scrapeArchiveFromWeb } = require('./src/archiveFetcher');
const { connectDB } = require('./src/db');
const cron = require('node-cron');
const scrapeNews  = require('./src/scrapers/scrapeNews');

// ========== 🔁 Cache Saver ========== //
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

// ========== 🔁 Cache Saver for Indices ==========
async function saveIndicesCache(data) {
  const db = await connectDB();
  const collection = db.collection('indices_cache');

  await collection.updateOne(
    { type: 'indices' },
    {
      $set: {
        type: 'indices',
        data,
        timestamp: new Date()
      }
    },
    { upsert: true }
  );

  console.log(`[indices] Cache saved`);
}

// ========== 🚀 Scrape Live/DSE30/Top20 ========== //
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
    console.error('Error during scraping:', error.message);
  }
}

// ========== 🚀 Scrape Indices ==========
async function scrapeAndSaveIndices() {
  try {
    const homepageResp = await axios.get('https://www.dsebd.org/');
    const indices = await scrapeIndicesFromHomepage(homepageResp.data);

    await saveIndicesCache(indices);
  } catch (error) {
    console.error('Error during indices scraping:', error.message);
  }
}

// Run scraping once immediately on startup
scrapeAndSaveAll();
scrapeAndSaveIndices();

// Schedule scraping every 60 seconds for live/DSE30/Top20
setInterval(scrapeAndSaveAll, 60 * 1000);

// Schedule scraping every 60 seconds for indices
setInterval(scrapeAndSaveIndices, 60 * 1000);

// ========== 📅 Archive Scraper Cron Job ========== //
// Helper to get yesterday's date (format: YYYY-MM-DD)
function getScrapeDate() {
  const now = new Date();

  // Convert current time to BD timezone offset in ms (+6h)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (6 * 3600000));

  // If current BD time is after market close + buffer (say 16:00),
  // scrape today's date; otherwise scrape yesterday.
  if (bdTime.getHours() >= 16) {
    // After 4 PM BD time, scrape today
    return bdTime.toISOString().slice(0, 10);
  } else {
    // Before 4 PM, scrape yesterday
    bdTime.setDate(bdTime.getDate() - 1);
    return bdTime.toISOString().slice(0, 10);
  }
}

// Schedule archive scraping at 6 PM Bangladesh time (12 PM UTC)
cron.schedule('0 12 * * *', async () => {
  const startDate = getScrapeDate();
  const endDate = startDate;

  try {
    console.log(`[archive] Starting archive scrape for ${startDate}...`);

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
      console.log(`[archive] Archive for ${startDate} saved (${data.length} items)`);
    } else {
      console.log(`[archive] No data scraped for ${startDate}`);
    }
  } catch (err) {
    console.error('[archive] Error scraping archive:', err.message);
  }
});

// ========== 📰 News Scraper Cron Job ========== //
// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running automated news scraper...');
  try {
    await scrapeNews();
    console.log('News scraped successfully.');
  } catch (e) {
    console.error('News scraping failed:', e.message);
  }
});
// Optional: quick test of DSE30 on startup
(async () => {
  try {
    const dse30 = await scrapeDSE30();
    console.log(`[startup test] DSE30 items: ${dse30.length}`);
  } catch (error) {
    console.error('[startup test] Error testing scrapeDSE30:', error.message);
  }
})();


