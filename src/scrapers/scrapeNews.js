const axios = require("axios");
const cheerio = require("cheerio");
const { connectDB } = require("../db");

const NLP_SERVICE_URL = "http://localhost:8000/analyze_batch"; // Python microservice
const sources = [
  {
    name: "DailyStarEconomy",
    url: "https://www.thedailystar.net/business/economy",
  },
  {
    name: "DailyStarBanking",
    url: "https://www.thedailystar.net/business/banking",
  },
  {
    name: "DailyStarTelecom",
    url: "https://www.thedailystar.net/business/telecom",
  },
  {
    name: "BusinessStandardStocks",
    url: "https://www.tbsnews.net/economy/stocks",
  },
  {
    name: "BusinessStandardIndustry",
    url: "https://www.tbsnews.net/economy/industry",
  },
  { name: "ProthomAloBusiness", url: "https://en.prothomalo.com/business" },
];

function normalizeText(text) {
  return (text || "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function generateAliases(companyName, code) {
  const aliases = new Set();
  if (!companyName) return [];
  const cleaned = companyName.replace(/\b(LTD\.?|LIMITED|PLC)\b/i, "").trim();
  aliases.add(cleaned.toUpperCase());
  aliases.add(code.toUpperCase()); // always include the stock code
  const words = cleaned.split(" ").filter((w) => w.length > 1);
  if (words.length > 1) aliases.add(words.slice(0, 2).join(" ").toUpperCase());
  if (words.length > 2) aliases.add(words.slice(0, 3).join(" ").toUpperCase());
  return Array.from(aliases);
}

async function loadStockData() {
  const db = await connectDB();
  const cache = await db.collection("live_cache").findOne({ type: "live" });
  if (!cache || !cache.data) return {};
  const stockMap = {};
  cache.data.forEach((stock) => {
    if (!stock.code || !stock.companyName) return;
    const code = stock.code.toUpperCase();
    stockMap[code] = {
      code,
      companyName: stock.companyName,
      aliases: generateAliases(stock.companyName, code),
    };
  });
  console.log(
    `[stocks] Loaded ${Object.keys(stockMap).length} companies from live_cache`
  );
  return stockMap;
}

async function scrapeSourceArticles(source) {
  try {
    const res = await axios.get(source.url);
    const $ = cheerio.load(res.data);
    const selectors = [
      "article h2 a",
      "article h3 a",
      ".story__title a",
      ".title a",
      ".headline a",
      ".listing-block__title a",
      ".post-title a",
      ".story__title a",
      ".story__headline a",
      "div.card-section h2.card-title a",
      "div.card-section h3.card-title a",
      "div.card-with-image-zoom h3.headline-title a",
      "h2 a",
      "h3 a"
    ];
  
    const articles = [];
    const seenLinks = new Set();
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        let title = $(el).text().trim().replace(/\s+/g, " ");
        let link = $(el).attr("href");
        if (!title || !link || title.length < 8) return;
        if (/email-protection|show more/i.test(title)) return;
        link = resolveUrl(source.url, link);
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        articles.push({ title, link, source: source.name });
      });
    }
    return articles;
  } catch (e) {
    console.warn(`[scraper] failed ${source.name}: ${e.message}`);
    return [];
  }
}

async function analyzeBatch(articleTitle, stockCandidates) {
  try {
    const payload = { text: articleTitle, candidates: stockCandidates };
    const res = await axios.post(NLP_SERVICE_URL, payload, { timeout: 30000 });
    return res.data;
  } catch (err) {
    console.error("NLP batch error:", err.message);
    return [];
  }
}

async function scrapeNews() {
  const stockMap = await loadStockData();
  if (!Object.keys(stockMap).length) return;

  const db = await connectDB();
  const newsCol = db.collection("news_archive");
  const stockCandidates = Object.values(stockMap).map((s) => ({
    code: s.code,
    aliases: s.aliases,
  }));

  let processed = 0,
    totalMatches = 0;
  const seen = new Set();

  for (const src of sources) {
    console.log(`[news] scraping ${src.name}`);
    const articles = await scrapeSourceArticles(src);
    for (const art of articles) {
      processed++;
      const key = `${art.title}::${art.link}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const analysisResults = await analyzeBatch(art.title, stockCandidates);
      const relevantStocks = analysisResults.filter((r) => r.relevant);
      if (!relevantStocks.length) continue;

      try {
        await newsCol.updateOne(
          { title: art.title, link: art.link },
          {
            $set: {
              title: art.title,
              link: art.link,
              source: art.source,
              stockCodes: relevantStocks.map((r) => r.code),
              relevanceScores: relevantStocks.map((r) => r.relevance_score),
              sentimentLabel: relevantStocks[0].sentiment_label,
              sentimentScore: relevantStocks[0].sentiment_score,
              date: new Date(),
              scrapedAt: new Date(),
            },
          },
          { upsert: true }
        );
        totalMatches += relevantStocks.length;
        console.log(
          `[news] matched: "${art.title.substring(
            0,
            80
          )}..." -> ${relevantStocks.map((r) => r.code).join(", ")}`
        );
      } catch (e) {
        console.warn(`[news] db save failed: ${e.message}`);
      }
    }
  }

  console.log(
    `[news] done. Processed ${processed} articles, total matched company occurrences: ${totalMatches}`
  );
}

module.exports = scrapeNews;
