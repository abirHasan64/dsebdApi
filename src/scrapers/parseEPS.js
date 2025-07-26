const cheerio = require('cheerio');

function parseEPS($) {
  const headerRows = $('table#company tr.header').slice(0, 4);
  const periodLabels = [];
  headerRows.eq(1).find('td').each((_, td) => {
    periodLabels.push($(td).text().trim());
  });

  const periodEndings = [];
  const row3Tds = headerRows.eq(2).find('td');
  const row4Tds = headerRows.eq(3).find('td');

  let i3 = 0, i4 = 0;
  for (let i = 0; i < periodLabels.length; i++) {
    const cell3 = row3Tds[i3];
    if (cell3) {
      const $cell3 = $(cell3);
      const rowspan = parseInt($cell3.attr('rowspan') || '1', 10);
      const text3 = $cell3.text().trim();

      if (rowspan > 1) {
        periodEndings.push(text3);
        i3++;
      } else {
        const cell4 = row4Tds[i4];
        if (cell4) {
          periodEndings.push($(cell4).text().trim());
          i4++;
        } else {
          periodEndings.push(text3);
        }
        i3++;
      }
    } else {
      periodEndings.push('');
    }
  }

  const periods = periodLabels.map((label, i) => ({
    label,
    ending: periodEndings[i] || ''
  }));

  // Extract Basic EPS
  let basicEPS = {};
  let inEPSSection = false;

  $('table#company tr').each((_, tr) => {
    const td = $(tr).find('td');
    const firstTd = td.first().text().trim();

    if (
      td.length === 1 &&
      td.attr('colspan') === '7' &&
      firstTd.includes('Earnings Per Share')
    ) {
      inEPSSection = true;
      return;
    }

    if (
      inEPSSection &&
      td.length === 1 &&
      $(tr).hasClass('header') &&
      !firstTd.includes('Earnings')
    ) {
      inEPSSection = false;
      return false;
    }

    if (inEPSSection && firstTd === 'Basic' && !$(tr).hasClass('header')) {
      td.slice(1).each((i, cell) => {
        if (!periods[i]) return;
        basicEPS[periods[i].label] = {
          ending: periods[i].ending,
          value: $(cell).text().trim()
        };
      });
    }
  });

  return basicEPS;
}

module.exports = parseEPS;
