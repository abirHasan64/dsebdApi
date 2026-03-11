/**
 * Calculates Net Asset Value (NAV) per share
 * Formula: (Paid-up Capital + Reserve & Surplus + OCI) / Total Outstanding Shares
 * @param {string} paidUpCapital_mn - Paid-up capital in millions
 * @param {string} reserveSurplus_mn - Reserve surplus in millions
 * @param {string} oci_mn - Other Comprehensive Income in millions
 * @param {string} totalOutstandingShares - Total outstanding shares
 * @returns {number|null} NAV per share or null if calculation not possible
 */

function parseNAV(paidUpCapital_mn, reserveSurplus_mn, oci_mn, totalOutstandingShares) {
  const paid = parseFloat(paidUpCapital_mn?.replace(/,/g, ''));
  const reserve = parseFloat(reserveSurplus_mn?.replace(/,/g, '') || '0');
  const oci = parseFloat(oci_mn?.replace(/,/g, '') || '0');
  const totalShares = parseFloat(totalOutstandingShares?.replace(/,/g, ''));

  if (!isNaN(paid) && !isNaN(totalShares) && totalShares > 0) {
    const netAssets = (paid + reserve + oci) * 1_000_000;
    return parseFloat((netAssets / totalShares).toFixed(2));
  }

  return null;
}

module.exports = parseNAV;

  