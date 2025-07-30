// const scrapeLive = require('./src/scrapers/scrapeLive');
// const scrapeDSE30 = require('./src/scrapers/scrapeDSE30');
// const scrapeTop20 = require('./src/scrapers/scrapeTop20');
// const { connectDB } = require('./src/db');
// const cron = require('node-cron'); // Keep it if you plan to use cron scheduling later

// // Self-invoking async function to test scrapeDSE30 on startup
// (async () => {
//   try {
//     const dse30 = await scrapeDSE30();
//   } catch (error) {
//     console.error('Error testing scrapeDSE30:', error.message);
//   }
// })();

// /**
//  * Save data cache to MongoDB collection `${type}_cache`.
//  * Replaces existing cache document with upsert.
//  * @param {string} type - Cache type (e.g., 'live', 'dse30', 'top20')
//  * @param {any} data - Data to be cached
//  */
// async function saveCache(type, data) {
//   const db = await connectDB();
//   const collection = db.collection(`${type}_cache`);

//   await collection.updateOne(
//     { type },
//     {
//       $set: {
//         type,
//         data,
//         timestamp: new Date() // Store UTC server time
//       }
//     },
//     { upsert: true }
//   );

//   console.log(`[${type}] Cache saved (${Array.isArray(data) ? data.length : 1} items)`);
// }

// /**
//  * Scrape all data sources and save caches.
//  * Runs all scrapes concurrently, then saves caches concurrently.
//  */
// async function scrapeAndSaveAll() {
//   try {
//     const liveRaw = await scrapeLive();
//     const live = liveRaw[0]?.stocks || [];

//     // Scrape DSE30 and Top20 concurrently
//     const [dse30, top20] = await Promise.all([
//       scrapeDSE30(),
//       scrapeTop20()
//     ]);

//     // Save all caches concurrently
//     await Promise.all([
//       saveCache('live', live),
//       saveCache('dse30', dse30),
//       saveCache('top20', top20)
//     ]);
//   } catch (error) {
//     console.error('Error during scraping:', error.message);
//   }
// }

// // Run scraping once immediately on startup
// scrapeAndSaveAll();

// // Schedule scraping every 60 seconds (can switch to cron later if preferred)
// setInterval(scrapeAndSaveAll, 60 * 1000);

const scrapeLive = require('./src/scrapers/scrapeLive');
const scrapeDSE30 = require('./src/scrapers/scrapeDSE30');
const scrapeTop20 = require('./src/scrapers/scrapeTop20');
const { scrapeArchiveFromWeb } = require('./src/archiveFetcher');
const { connectDB } = require('./src/db');
const cron = require('node-cron');

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

// Run scraping once immediately on startup
scrapeAndSaveAll();

// Schedule scraping every 60 seconds
setInterval(scrapeAndSaveAll, 60 * 1000);

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

// Optional: quick test of DSE30 on startup
(async () => {
  try {
    const dse30 = await scrapeDSE30();
    console.log(`[startup test] DSE30 items: ${dse30.length}`);
  } catch (error) {
    console.error('[startup test] Error testing scrapeDSE30:', error.message);
  }
})();
