const express = require('express');
const path = require('path');
const router = express.Router();
const { scrapeLive, scrapeDSE30, scrapeTop20 } = require('./scraper');
const { scrapeArchiveFromWeb } = require('./archiveFetcher');
const { connectDB } = require('./db');

// Helper: get array of dates between two dates (inclusive)
function getDateRangeArray(start, end) {
  const arr = [];
  let dt = new Date(start);
  const endDt = new Date(end);
  while (dt <= endDt) {
    arr.push(dt.toISOString().slice(0, 10));
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

function formatToDhakaTime(date) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour12: false
  }).replace(',', '');
}

router.get('/live/indices', async (req, res) => {
  try {
    const db = await connectDB();
    const cache = await db.collection('indices_cache').findOne({ type: 'indices' });

    if (!cache) return res.status(404).json({ error: 'No indices data found' });

    res.json({
      lastUpdated: formatToDhakaTime(new Date(cache.timestamp)),
      data: cache.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/live', async (req, res) => {
  try {
    const db = await connectDB();
    const cache = await db.collection('live_cache').findOne({ type: 'live' });

    if (!cache) return res.status(404).json({ error: 'No live data found' });

    res.json({
      lastUpdated: formatToDhakaTime(new Date(cache.timestamp)),
      data: cache.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const [{ stocks }] = await scrapeLive();
    const stock = stocks.find(s => s.code.toUpperCase() === code);

    if (!stock) {
      return res.status(404).json({ error: `Stock '${code}' not found.` });
    }

    res.json(stock);
  } catch (e) {
    console.error(`Error fetching live data for ${code}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});



router.get('/dse30', async (req, res) => {
  try {
    const db = await connectDB();
    const cache = await db.collection('dse30_cache').findOne({ type: 'dse30' });

    if (!cache) return res.status(404).json({ error: 'No DSE30 data found' });

    res.json({
      lastUpdated: formatToDhakaTime(new Date(cache.timestamp)),
      data: cache.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route to get Top 20 shares
router.get('/top20', async (req, res) => {
  try {
    const db = await connectDB();
    const cache = await db.collection('top20_cache').findOne({ type: 'top20' });

    if (!cache) return res.status(404).json({ error: 'No Top 20 data found' });

    res.json({
      lastUpdated: formatToDhakaTime(new Date(cache.timestamp)),
      data: cache.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive route with deduplication and DB caching
router.get('/archive', async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' });
  }

  try {
    const db = await connectDB();
    const col = db.collection('history');

    // Fetch existing data from MongoDB in the date range
    const existingData = await col.find({
      date: { $gte: startDate, $lte: endDate }
    }).toArray();

    // Determine which dates are missing in the DB
    const existingDates = new Set(existingData.map(d => d.date));
    const allDates = getDateRangeArray(startDate, endDate);
    const missingDates = allDates.filter(date => !existingDates.has(date));

    let scrapedData = [];
    if (missingDates.length > 0) {
      // Scrape the missing date range from the website
      const scrapeStart = missingDates[0];
      const scrapeEnd = missingDates[missingDates.length - 1];

      scrapedData = await scrapeArchiveFromWeb(scrapeStart, scrapeEnd);

      if (scrapedData.length > 0) {
        // Bulk upsert scraped data to MongoDB to avoid duplicates
        const bulkOps = scrapedData.map(doc => ({
          updateOne: {
            filter: { date: doc.date, code: doc.code },
            update: { $set: doc },
            upsert: true
          }
        }));

        await col.bulkWrite(bulkOps);
      }
    }

    // Fetch full data again after insertion to send back combined data
    const finalData = await col.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 }).toArray();

    res.json(finalData);
  } catch (e) {
    console.error('Error in /archive:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/archive/latest', async (req, res) => {
  try {
    const db = await connectDB();
    const col = db.collection('history');

    // Get the latest archive entry
    const latest = await col
      .find()
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    if (latest.length === 0) {
      return res.status(404).json({ message: 'No data found in history collection.' });
    }

    const latestEntry = latest[0];

    // Check for duplicates: count how many documents share this same date + code
    const duplicateCount = await col.countDocuments({
      date: latestEntry.date,
      code: latestEntry.code
    });

    let duplicates = [];
    if (duplicateCount > 1) {
      duplicates = await col
        .find({ date: latestEntry.date, code: latestEntry.code })
        .toArray();
    }

    res.json({
      latest: latestEntry,
      duplicateCount,
      duplicates: duplicateCount > 1 ? duplicates : undefined
    });
  } catch (e) {
    console.error('Error in /archive/latest:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Archive by stock code
router.get('/archive/:code', async (req, res) => {
  const { startDate, endDate } = req.query;
  const { code } = req.params;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' });
  }

  if (!code) {
    return res.status(400).json({ error: 'Stock code is required in URL path' });
  }

  try {
    const db = await connectDB();
    const col = db.collection('history');

    const data = await col.find({
      code: code.toUpperCase(),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 }).toArray();

    res.json(data);
  } catch (e) {
    console.error('Error in /archive/:code:', e);
    res.status(500).json({ error: e.message });
  }
});



// Simple API health check
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = router;