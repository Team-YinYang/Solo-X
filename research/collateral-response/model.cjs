// Research-only policy, not an on-chain pause or price oracle.
function response({priceBps, priceVerified, frozen, reserveDeficit, chainVerified}) {
  if (typeof frozen !== "boolean" || typeof reserveDeficit !== "boolean" ||
      typeof chainVerified !== "boolean" || typeof priceVerified !== "boolean") throw new TypeError("Explicit observations required");
  const priceKnown = priceVerified && Number.isSafeInteger(priceBps) && priceBps > 0;
  const depeg = priceKnown && (priceBps < 9900 || priceBps > 10100);
  const reasons = [];
  if (!chainVerified) reasons.push("chain-unverified");
  if (!priceKnown) reasons.push("price-unverified");
  if (depeg) reasons.push("depeg");
  if (frozen) reasons.push("issuer-freeze");
  if (reserveDeficit) reasons.push("reserve-deficit");
  return {
    reasons,
    offerMint: reasons.length === 0,
    offerConversion: reasons.length === 0,
    offerRedemption: chainVerified && !frozen && !reserveDeficit,
    dollarParityGuaranteed: false,
    requiresReview: reasons.length > 0,
  };
}
module.exports = { response };
