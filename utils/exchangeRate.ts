export interface LiveExchangeRateResult {
  rate: number;
  dateLabel: string;
  source: string;
}

export const fetchLiveEurMadRate = async (): Promise<LiveExchangeRateResult> => {
  // Primary: Open ExchangeRate-API (CORS-enabled, daily updated)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const madRate = data?.rates?.MAD;
      if (typeof madRate === 'number' && !isNaN(madRate) && madRate > 0) {
        const updatedDate = data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toLocaleDateString('fr-FR')
          : new Date().toLocaleDateString('fr-FR');
        return {
          rate: Number(madRate.toFixed(4)),
          dateLabel: updatedDate,
          source: 'ExchangeRate-API'
        };
      }
    }
  } catch {
    // Fall through to backup endpoint
  }

  // Fallback: Fawaz Ahmed Currency API via jsDelivr CDN (CORS-enabled)
  const fallbackRes = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
    { cache: 'no-store' }
  );
  if (!fallbackRes.ok) {
    throw new Error('Impossible de récupérer le taux du jour.');
  }
  const fallbackData = await fallbackRes.json();
  const madFallback = fallbackData?.eur?.mad;
  if (typeof madFallback !== 'number' || isNaN(madFallback) || madFallback <= 0) {
    throw new Error('Taux EUR/MAD indisponible.');
  }

  const dateLabel = fallbackData.date
    ? new Date(fallbackData.date).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  return {
    rate: Number(madFallback.toFixed(4)),
    dateLabel,
    source: 'Currency-API'
  };
};
