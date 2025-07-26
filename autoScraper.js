const { scrapeLive, scrapeTop20, scrapeDSE30 } = require('./src/scrapers');
const { scrapeArchiveFromWeb } = require('./src/archiveFetcher');
const Archive = require('./src/models/archiveModel'); // Assumes you store archive in DB
const cron = require('node-cron');

// --- LIVE SCRAPERS (Every 30s) ---
async function scrapeAll() {
  try {
    await Promise.all([
      scrapeLive(),
      scrapeTop20(),
      scrapeDSE30()
    ]);
  } catch (err) {
    console.error('[Scraper Error]', err.message);
  }
}

scrapeAll();
setInterval(scrapeAll, 30 * 1000);

// --- ARCHIVE SCRAPER (Daily at 3:00PM BD Time) ---
async function scrapeAndSaveArchive() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  try {
    const rows = await scrapeArchiveFromWeb(dateStr, dateStr);
    for (const row of rows) {
      await Archive.updateOne(
        { code: row.code, date: row.date },
        { $set: row },
        { upsert: true }
      );
    }
    console.log(`[${dateStr}] Archive data saved (${rows.length} rows)`);
  } catch (err) {
    console.error(`[${dateStr}]  Archive fetch failed:`, err.message);
  }
}

cron.schedule('0 9 * * *', () => {
  console.log('3:00 PM BD time: Running archive scraper');
  scrapeAndSaveArchive();
}, {
  timezone: 'Asia/Dhaka'
});
