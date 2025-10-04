// scrapeNews.js
const axios = require("axios");
const cheerio = require("cheerio");
const Sentiment = require("sentiment");
const { connectDB } = require("../db");
const fs = require("fs");
const path = require("path");

const sentiment = new Sentiment();

// News sources
const sources = [
  { name: "DailyStarBusiness", url: "https://www.thedailystar.net/business" },
  { name: "DailyStarEconomy", url: "https://www.thedailystar.net/business/economy" },
  { name: "DailyStarBanking", url: "https://www.thedailystar.net/business/banking" },
  { name: "DailyStarExport", url: "https://www.thedailystar.net/business/export" },
  { name: "DailyStarTax", url: "https://www.thedailystar.net/business/tax-and-customs" },
  { name: "DailyStarGlobal", url: "https://www.thedailystar.net/business/global-economy" },
  { name: "ProthomAloLocal", url: "https://en.prothomalo.com/business/local" },
  { name: "ProthomAloGlobal", url: "https://en.prothomalo.com/business/global" },
  { name: "BusinessStandardStock", url: "https://www.tbsnews.net/economy/stocks" },
  { name: "BusinessStandardIndustry", url: "https://www.tbsnews.net/economy/industry" },
  { name: "BusinessStandardBanking", url: "https://www.tbsnews.net/economy/banking" },
];

// Load stock aliases
const stockFilePath = path.join(__dirname, "../stocks.json");

function loadStockAliases() {
  try {
    const stockDataRaw = JSON.parse(fs.readFileSync(stockFilePath, "utf-8"));
    const aliases = {};
    const aliasConflicts = new Map();

    for (const code in stockDataRaw) {
      const upperCode = code.toUpperCase();
      const codeAliases = [
        ...new Set([
          ...stockDataRaw[code].map(n => n.toUpperCase().trim()),
          upperCode
        ])
      ].filter(a => a.length > 0);

      aliases[upperCode] = {
        aliases: codeAliases,
        primaryName: stockDataRaw[code][0] || upperCode,
        code: upperCode,
        searchTerms: generateSearchTerms(stockDataRaw[code])
      };

      codeAliases.forEach(alias => {
        if (!aliasConflicts.has(alias)) aliasConflicts.set(alias, []);
        aliasConflicts.get(alias).push(upperCode);
      });
    }

    return { aliases, aliasConflicts };
  } catch (err) {
    console.error("❌ Failed to load stocks.json:", err.message);
    return { aliases: {}, aliasConflicts: new Map() };
  }
}

const { aliases: stockData, aliasConflicts } = loadStockAliases();

function generateSearchTerms(companyNames) {
  const terms = new Set();
  companyNames.forEach(name => {
    const upperName = name.toUpperCase();
    terms.add(upperName);

    // Remove generic suffixes
    const withoutSuffix = upperName.replace(
      /\s+(LIMITED|LTD|PLC|CORP|CORPORATION|CO|COMPANY|BANGLADESH|BD|BANK|INSURANCE|FINANCE)\b/gi, ''
    ).trim();
    if (withoutSuffix.length > 3 && withoutSuffix !== upperName) terms.add(withoutSuffix);

    const words = upperName.split(/\s+/).filter(word => word.length >= 2 && !['THE','AND','OR','OF','IN','FOR','FIRST','SECOND','1ST','2ND'].includes(word));
    if (words.length > 1) {
      terms.add(words.slice(0,2).join(' '));
      if (words.length > 2) terms.add(words[0] + ' ' + words[words.length-1]);
    }
  });
  return Array.from(terms).filter(t => t.length >= 2);
}

// Words too generic to match alone
const PROBLEMATIC_WORDS = new Set([
  'THE', 'AND', 'OR', 'BUT', 'FOR', 'LTD', 'LIMITED', 'CO', 'CORP', 'PLC',
  'BANK', 'INSURANCE', 'FINANCE', 'MUTUAL', 'FUND', 'INDUSTRIES', 'COMPANY',
  'FIRST', 'SECOND', 'THIRD', '1ST', '2ND', '3RD', 'UNION'
]);

// Patterns that indicate false positives
const FALSE_POSITIVE_PATTERNS = [
  /trade\s+union/i,
  /workers?\s+union/i,
  /labor\s+union/i,
  /employee\s+union/i,
  /industrial\s+union/i,
  /credit\s+union/i,
  /student\s+union/i,
  /union\s+of/i,
  /union\s+leader/i,
  /union\s+member/i,
  /form\s+union/i,
  /join\s+union/i
];

function isLikelyFalsePositive(text, term) {
  const upperText = text.toUpperCase();
  const upperTerm = term.toUpperCase();

  if (PROBLEMATIC_WORDS.has(upperTerm)) {
    for (const pattern of FALSE_POSITIVE_PATTERNS) {
      if (pattern.test(text)) return true;
    }
  }

  return false;
}

async function fetchWithRetry(url, retries = 3, timeout = 15000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } });
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2,i)*1000));
    }
  }
}

function resolveUrl(base, relative) {
  try { return new URL(relative, base).href; } catch { return relative; }
}

function isValidArticle(article) {
  return article.title && article.link && article.title.length >= 10 && /^https?:\/\//.test(article.link);
}

// Improved company detection
function findMentionedCompanies(text, companiesMap) {
  const mentioned = new Map();
  const upperText = text.toUpperCase();

  for (const [code, data] of Object.entries(companiesMap)) {
    const allTerms = [...new Set([...data.aliases, ...data.searchTerms])].sort((a,b)=>b.length-a.length);

    for (const term of allTerms) {
      const termUpper = term.toUpperCase();

      // Skip problematic terms unless strong context exists
      if (PROBLEMATIC_WORDS.has(termUpper) && termUpper !== code) {
        const contextKeywords = ['BANK','FINANCE','FINANCIAL','STOCK','SHARE','DEPOSIT','LOAN'];
        const hasStrongContext = contextKeywords.some(k => upperText.includes(k)) || 
                                 upperText.includes(data.primaryName.toUpperCase());
        if (!hasStrongContext || isLikelyFalsePositive(text, term)) continue;
      }

      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'i');
      if (regex.test(text) && !mentioned.has(code)) {
        mentioned.set(code, { code, matchedAlias: term, companyName: data.primaryName });
      }
    }
  }

  return Array.from(mentioned.values());
}

async function scrapeSource(source) {
  try {
    const res = await fetchWithRetry(source.url);
    const $ = cheerio.load(res.data);
    const articles = [];
    const selectors = ["article h2 a","article h3 a",".story__title a",".title a",".headline a","h2 a","h3 a",".news-title a","a.news-link",".content a",".card a",".node-title a",".views-row a","a"];

    for (const selector of selectors) {
      const foundArticles = [];
      $(selector).each((_, el) => {
        const title = $(el).text().trim().replace(/\s+/g,' ');
        let link = $(el).attr("href");
        if (title && link && title.length > 10) {
          link = resolveUrl(source.url, link);
          const isLikelyArticle = !link.match(/(category|tag|author|page|login|signup|static|image)=/i) && title.split(' ').length >= 3;
          if (isLikelyArticle) foundArticles.push({title, link, source: source.name});
        }
      });
      if (foundArticles.length > 2) { articles.push(...foundArticles); break; }
    }

    return articles;
  } catch (e) {
    console.warn(`Failed to scrape ${source.name}: ${e.message}`);
    return [];
  }
}

// Main scraping function
async function scrapeNews() {
  const startTime = Date.now();
  console.log(`🚀 Starting news scraping for ${Object.keys(stockData).length} companies`);
  const db = await connectDB();
  const newsCol = db.collection("news_archive");

  let totalArticlesProcessed = 0;
  let totalMatchesFound = 0;
  const seenTitles = new Set();

  for (const source of sources) {
    console.log(`🔍 Scraping: ${source.name}`);
    const articles = await scrapeSource(source);
    await new Promise(r => setTimeout(r, 1000));

    for (const article of articles) {
      const titleHash = Buffer.from(article.title + article.source).toString('base64');
      if (seenTitles.has(titleHash)) continue;
      seenTitles.add(titleHash);
      if (!isValidArticle(article)) continue;

      totalArticlesProcessed++;
      const mentionedCompanies = findMentionedCompanies(article.title, stockData);

      if (mentionedCompanies.length > 0) {
        const sentimentResult = sentiment.analyze(article.title);
        const stockCodes = mentionedCompanies.map(c => c.code);
        const matchedAliases = mentionedCompanies.map(c => c.matchedAlias);

        await newsCol.updateOne(
          { title: article.title, link: article.link },
          {
            $set: {
              title: article.title,
              link: article.link,
              stockCodes,
              matchedAliases,
              sentimentScore: sentimentResult.score,
              sentimentComparative: sentimentResult.comparative,
              source: article.source,
              date: new Date(),
              lastUpdated: new Date(),
              scrapedAt: new Date()
            }
          },
          { upsert: true }
        );

        totalMatchesFound += mentionedCompanies.length;
        console.log(`✅ Matched: "${article.title}" -> ${stockCodes.join(', ')}`);
      }
    }
  }

  console.log(`\n✅ Scraping finished: ${totalArticlesProcessed} articles processed, ${totalMatchesFound} stock mentions`);
  console.log(`⏱ Duration: ${Date.now() - startTime}ms`);
}

module.exports = scrapeNews;