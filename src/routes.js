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

router.get('/live', async (req, res) => {
  try {
    const db = await connectDB();
    const cacheCollection = db.collection('live_cache');

    // Check if cached data exists and is fresh (within 1 minute)
    const cache = await cacheCollection.findOne({ type: 'live' });

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    if (cache && cache.timestamp > oneMinuteAgo) {
      return res.json(cache.data);
    }

    // Fetch fresh data
    const liveData = await scrapeLive();

    // Store in cache (upsert)
    await cacheCollection.updateOne(
      { type: 'live' },
      {
        $set: {
          type: 'live',
          data: liveData,
          timestamp: new Date()
        }
      },
      { upsert: true }
    );

    res.json(liveData);
  } catch (err) {
    console.error('Error in /live route:', err.message);
    res.status(500).json({ error: 'Failed to fetch live data' });
  }
});

// Single stock live data
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

// Route to get DSE30 shares
router.get('/dse30', async (req, res) => {
  try {
    const data = await scrapeDSE30();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route to get Top 20 shares
router.get('/top20', async (req, res) => {
  try {
    const data = await scrapeTop20();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
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