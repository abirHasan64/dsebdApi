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
  