const axios = require('axios');
const cheerio = require('cheerio');
const parseEPS = require('./parseEPS');
const parseNAV = require('./parseNAV');

async function getStockInfo(code) {
  try {
    const url = `https://www.dsebd.org/displayCompany.php?name=${code}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    let sector, authorizedCapital_mn, paidUpCapital_mn, cashDividend, stockDividend, yearEnd, reserveSurplus_mn, oci_mn, totalOutstandingShares;

    $('table.table-bordered.background-white#company tr').each((_, tr) => {
      const thText = $(tr).find('th').text().trim();
      const tdText = $(tr).find('td').text().trim();

      switch (thText) {
        case 'Cash Dividend':
          cashDividend = tdText;
          break;
        case 'Bonus Issue (Stock Dividend)':
          stockDividend = tdText;
          break;
        case 'Year End':
          yearEnd = tdText;
          break;
        case 'Reserve & Surplus without OCI (mn)':
          reserveSurplus_mn = tdText;
          break;
        case 'Other Comprehensive Income (OCI) (mn)':
          oci_mn = tdText;
          break;
      }
    });

    $('table.table-bordered.background-white#company tr').each((_, tr) => {
      const ths = $(tr).find('th');
      const tds = $(tr).find('td');
      ths.each((i, th) => {
        const header = $(th).text().trim();
        if (header === 'Authorized Capital (mn)') authorizedCapital_mn = $(tds[i]).text().trim();
        else if (header === 'Paid-up Capital (mn)') paidUpCapital_mn = $(tds[i]).text().trim();
        else if (header === 'Sector') sector = $(tds[i]).text().trim();
        else if (header === 'Total No. of Outstanding Securities') totalOutstandingShares = $(tds[i]).text().trim();
      });
    });

    const basicEPS = parseEPS($);
    const nav = parseNAV(paidUpCapital_mn, reserveSurplus_mn, oci_mn, totalOutstandingShares);

    return {
      sector,
      authorizedCapital_mn,
      paidUpCapital_mn,
      cashDividend,
      stockDividend,
      yearEnd,
      reserveSurplus_mn,
      oci_mn,
      totalOutstandingShares,
      nav,
      basicEPS
    };
  } catch (err) {
    console.error(`Failed to fetch info for ${code}:`, err.message);
    return {};
  }
}

module.exports = getStockInfo;
