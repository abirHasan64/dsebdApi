// const axios = require("axios");
// const cheerio = require("cheerio");
// const parseEPS = require("./parseEPS");
// const parseNAV = require("./parseNAV");

// async function getStockInfo(code) {
//   try {
//     const url = `https://www.dsebd.org/displayCompany.php?name=${code}`;
//     const res = await axios.get(url); // 15 seconds
//     const $ = cheerio.load(res.data);

//     let sector,
//       authorizedCapital_mn,
//       paidUpCapital_mn,
//       cashDividend,
//       stockDividend,
//       yearEnd,
//       reserveSurplus_mn,
//       oci_mn,
//       totalOutstandingShares,
//       movingRange52W,
//       listingYear,
//       marketCategory,
//       shareHoldings = [];

//     // -------- Basic Dividend/Capital info --------
//     $("table.table-bordered.background-white#company tr").each((_, tr) => {
//       const thText = $(tr).find("th").text().trim();
//       const tdText = $(tr).find("td").text().trim();

//       switch (thText) {
//         case "Cash Dividend":
//           cashDividend = tdText;
//           break;
//         case "Bonus Issue (Stock Dividend)":
//           stockDividend = tdText;
//           break;
//         case "Year End":
//           yearEnd = tdText;
//           break;
//         case "Reserve & Surplus without OCI (mn)":
//           reserveSurplus_mn = tdText;
//           break;
//         case "Other Comprehensive Income (OCI) (mn)":
//           oci_mn = tdText;
//           break;
//         case "52 Weeks' Moving Range":
//           movingRange52W = tdText.includes("%")
//             ? tdText.split("%")[1].trim()
//             : tdText;
//           break;
//       }
//     });

//     // -------- Capital, Sector, Outstanding Shares --------
//     $("table.table-bordered.background-white#company tr").each((_, tr) => {
//       const ths = $(tr).find("th");
//       const tds = $(tr).find("td");
//       ths.each((i, th) => {
//         const header = $(th).text().trim();
//         if (header === "Authorized Capital (mn)")
//           authorizedCapital_mn = $(tds[i]).text().trim();
//         else if (header === "Paid-up Capital (mn)")
//           paidUpCapital_mn = $(tds[i]).text().trim();
//         else if (header === "Sector") sector = $(tds[i]).text().trim();
//         else if (header === "Total No. of Outstanding Securities")
//           totalOutstandingShares = $(tds[i]).text().trim();
//       });
//     });

//     // -------- Listing Year, Category --------
//     $("table.table-bordered.background-white#company tr").each((_, tr) => {
//       const tds = $(tr).find("td");
//       if (tds.length === 2) {
//         const label = $(tds[0]).text().trim();
//         const value = $(tds[1]).text().trim();

//         if (label === "Listing Year") listingYear = value;
//         else if (label === "Market Category") marketCategory = value;
//       }
//     });

//     // -------- Shareholding tables --------
//     $("table.table-bordered.background-white#company tr").each((_, tr) => {
//       const td = $(tr).find("td").first().text().trim();
//       if (td.startsWith("Share Holding Percentage")) {
//         const period = td; // e.g. "Share Holding Percentage [as on Aug 31, 2025]"
//         const percentages = {};
//         $(tr)
//           .find("table tr td")
//           .each((_, cell) => {
//             const text = $(cell).text().trim();
//             const [key, val] = text.split(":");
//             if (key && val) {
//               percentages[key.replace(/\n/g, "").trim()] = parseFloat(val) || 0;
//             }
//           });
//         shareHoldings.push({
//           period,
//           percentages,
//         });
//       }
//     });

//     // -------- EPS + NAV --------
//     const basicEPS = parseEPS($);
//     const nav = parseNAV(
//       paidUpCapital_mn,
//       reserveSurplus_mn,
//       oci_mn,
//       totalOutstandingShares
//     );

//     return {
//       listingYear,
//       sector,
//       marketCategory,
//       yearEnd,
//       movingRange52W,
//       authorizedCapital_mn,
//       paidUpCapital_mn,
//       cashDividend,
//       stockDividend,
//       reserveSurplus_mn,
//       oci_mn,
//       totalOutstandingShares,
//       nav,
//       basicEPS,
//       shareHoldings,
//     };
//   } catch (err) {
//     console.error(`Failed to fetch info for ${code}:`, err.message);
//     return {};
//   }
// }

// module.exports = getStockInfo;
const axios = require("axios");
const cheerio = require("cheerio");
const parseEPS = require("./parseEPS");
const parseNAV = require("./parseNAV");

async function getStockInfo(code) {
  try {
    const url = `https://www.dsebd.org/displayCompany.php?name=${code}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    // -------- Company Name --------
    let companyName = $("h2.BodyHead.topBodyHead i").first().text().trim();

    let sector,
      authorizedCapital_mn,
      paidUpCapital_mn,
      cashDividend,
      stockDividend,
      yearEnd,
      reserveSurplus_mn,
      oci_mn,
      totalOutstandingShares,
      movingRange52W,
      listingYear,
      marketCategory,
      shareHoldings = [];

    // -------- Basic Dividend/Capital info --------
    $("table.table-bordered.background-white#company tr").each((_, tr) => {
      const thText = $(tr).find("th").text().trim();
      const tdText = $(tr).find("td").text().trim();

      switch (thText) {
        case "Cash Dividend":
          cashDividend = tdText;
          break;
        case "Bonus Issue (Stock Dividend)":
          stockDividend = tdText;
          break;
        case "Year End":
          yearEnd = tdText;
          break;
        case "Reserve & Surplus without OCI (mn)":
          reserveSurplus_mn = tdText;
          break;
        case "Other Comprehensive Income (OCI) (mn)":
          oci_mn = tdText;
          break;
        case "52 Weeks' Moving Range":
          movingRange52W = tdText.includes("%")
            ? tdText.split("%")[1].trim()
            : tdText;
          break;
      }
    });

    // -------- Capital, Sector, Outstanding Shares --------
    $("table.table-bordered.background-white#company tr").each((_, tr) => {
      const ths = $(tr).find("th");
      const tds = $(tr).find("td");
      ths.each((i, th) => {
        const header = $(th).text().trim();
        if (header === "Authorized Capital (mn)")
          authorizedCapital_mn = $(tds[i]).text().trim();
        else if (header === "Paid-up Capital (mn)")
          paidUpCapital_mn = $(tds[i]).text().trim();
        else if (header === "Sector") sector = $(tds[i]).text().trim();
        else if (header === "Total No. of Outstanding Securities")
          totalOutstandingShares = $(tds[i]).text().trim();
      });
    });

    // -------- Listing Year, Market Category --------
    $("table.table-bordered.background-white#company tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 2) {
        const label = $(tds[0]).text().trim();
        const value = $(tds[1]).text().trim();

        if (label === "Listing Year") listingYear = value;
        else if (label === "Market Category") marketCategory = value;
      }
    });

    // -------- Shareholding tables --------
    $("table.table-bordered.background-white#company tr").each((_, tr) => {
      const tdText = $(tr).find("td").first().text().trim();
      if (tdText.startsWith("Share Holding Percentage")) {
        const period = tdText; // e.g., "Share Holding Percentage [as on Aug 31, 2025]"
        const percentages = {};

        // Check if there’s a nested table
        const nestedTable = $(tr).find("table");
        if (nestedTable.length) {
          $(nestedTable)
            .find("tr")
            .each((_, row) => {
              $(row)
                .find("td")
                .each((_, cell) => {
                  const text = $(cell).text().trim();
                  const [key, val] = text.split(":");
                  if (key && val) {
                    percentages[key.replace(/\n/g, "").trim()] = parseFloat(val) || 0;
                  }
                });
            });
        }

        shareHoldings.push({ period, percentages });
      }
    });

    // -------- EPS + NAV --------
    const basicEPS = parseEPS($);
    const nav = parseNAV(
      paidUpCapital_mn,
      reserveSurplus_mn,
      oci_mn,
      totalOutstandingShares
    );

    return {
      companyName,
      listingYear,
      sector,
      marketCategory,
      yearEnd,
      movingRange52W,
      authorizedCapital_mn,
      paidUpCapital_mn,
      cashDividend,
      stockDividend,
      reserveSurplus_mn,
      oci_mn,
      totalOutstandingShares,
      nav,
      basicEPS,
      shareHoldings,
    };
  } catch (err) {
    console.error(`Failed to fetch info for ${code}:`, err.message);
    return {};
  }
}

module.exports = getStockInfo;
