import { Article, Incoterm, Regime, CalculationResult, ArticleResult, RegimeDetail, GlobalLogistics } from '../types';

export const calculateCustoms = (
  articles023: Article[],
  regime: Regime,
  incoterm: Incoterm,
  logistics: GlobalLogistics,
  articlesAT: Article[] = []
): CalculationResult => {
  const { fretGlobalMAD, assuranceTaux, royaltiesMAD, tauxEurMad } = logistics;

  const isMixed = regime !== Regime.ONLY_023;
  const isCFR = incoterm === Incoterm.CFR;
  
  // In CFR mode, freight is NEVER added to the VD 
  const excludeFretFromVD = isCFR;

  // Calculate Global Weights for pro-rata distribution of logistics
  const totalPb023 = articles023.reduce((sum, a) => sum + a.poidsBrut, 0);
  const totalPbAT = isMixed ? articlesAT.reduce((sum, a) => sum + a.poidsBrut, 0) : 0;
  const globalPb = totalPb023 + totalPbAT;

  // We only pro-rate global freight for articles that don't have explicit line-level freight
  const totalPbForProRata = [...articles023, ...(isMixed ? articlesAT : [])]
    .filter(a => !(a.fretEUR && a.fretEUR > 0))
    .reduce((sum, a) => sum + a.poidsBrut, 0);

  const fretPerKg = totalPbForProRata > 0 ? fretGlobalMAD / totalPbForProRata : 0;
  const royaltiesPerKg = globalPb > 0 ? royaltiesMAD / globalPb : 0;

  const processArticleList = (list: Article[]): ArticleResult[] => {
    return list.map(art => {
      const cvMAD = art.valeurEUR * tauxEurMad;
      
      // Determine Freight: Line-level (EUR to MAD) OR Pro-rata
      let fretArtMAD = 0;
      if (art.fretEUR && art.fretEUR > 0) {
        fretArtMAD = art.fretEUR * tauxEurMad;
      } else {
        fretArtMAD = art.poidsBrut * fretPerKg;
      }

      const royaltiesArtMAD = art.poidsBrut * royaltiesPerKg;
      
      // Use 0 for VD calculation if CFR, otherwise use determined fret
      const fretForVD = excludeFretFromVD ? 0 : fretArtMAD;
      
      let baseAssurance: number;
      let vdArt: number;

      if (isCFR) {
        // Assurance based on Value (CFR usually includes freight in Value)
        baseAssurance = cvMAD;
        vdArt = (cvMAD * (1 + assuranceTaux / 100)) + fretForVD + royaltiesArtMAD;
      } else {
        // Standard (Value + Freight) * buffer + Royalties
        baseAssurance = cvMAD + fretArtMAD;
        vdArt = (baseAssurance * (1 + assuranceTaux / 100)) + royaltiesArtMAD;
      }

      return {
        id: art.id,
        designation: art.designation || `Item ${art.id}`,
        valeurEUR: art.valeurEUR,
        contreValeurMAD: cvMAD,
        fretProRataMAD: fretArtMAD,
        assuranceMAD: baseAssurance * (assuranceTaux / 100),
        partRoyaltiesMAD: royaltiesArtMAD,
        valeurDouaneArticle: vdArt
      };
    });
  };

  const perArticle023 = processArticleList(articles023);
  const perArticleAT = isMixed ? processArticleList(articlesAT) : [];

  const aggregateRegime = (results: ArticleResult[], original: Article[]): RegimeDetail => {
    return {
      valeurEUR: original.reduce((sum, a) => sum + a.valeurEUR, 0),
      valeurMAD: results.reduce((sum, r) => sum + r.contreValeurMAD, 0),
      poidsBrut: original.reduce((sum, a) => sum + a.poidsBrut, 0),
      poidsNet: original.reduce((sum, a) => sum + a.poidsNet, 0),
      fretMAD: results.reduce((sum, r) => (excludeFretFromVD ? 0 : r.fretProRataMAD), 0),
      assuranceMAD: results.reduce((sum, r) => sum + r.assuranceMAD, 0),
      royaltiesMAD: results.reduce((sum, r) => sum + r.partRoyaltiesMAD, 0),
      valeurDouaneTotal: results.reduce((sum, r) => sum + r.valeurDouaneArticle, 0)
    };
  };

  const regime023 = aggregateRegime(perArticle023, articles023);
  const regimeSecondary = isMixed ? aggregateRegime(perArticleAT, articlesAT) : undefined;

  return {
    totalValeurEUR: regime023.valeurEUR + (regimeSecondary?.valeurEUR || 0),
    totalValeurMAD: regime023.valeurMAD + (regimeSecondary?.valeurMAD || 0),
    totalPoidsBrut: globalPb,
    totalPoidsNet: articles023.reduce((sum, a) => sum + a.poidsNet, 0) + (isMixed ? articlesAT.reduce((sum, a) => sum + a.poidsNet, 0) : 0),
    totalFretMAD: regime023.fretMAD + (regimeSecondary?.fretMAD || 0),
    totalAssuranceMAD: regime023.assuranceMAD + (regimeSecondary?.assuranceMAD || 0),
    totalRoyaltiesMAD: royaltiesMAD,
    totalValeurDouane: regime023.valeurDouaneTotal + (regimeSecondary?.valeurDouaneTotal || 0),
    perArticle: [...perArticle023, ...perArticleAT],
    perArticle023,
    perArticleAT,
    regime023,
    regimeSecondary
  };
};

export const formatCurrency = (val: number) => {
  const formatted = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
  return formatted.replace(/[\u00A0\u202F]/g, ' ');
};

export const formatDecimal = (val: number, decimals: number = 2) => {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
  return formatted.replace(/[\u00A0\u202F]/g, ' ');
};

export const sanitizeNumericInput = (val: string): number => {
  if (val === '') return 0;
  const sanitized = val.toString().replace(',', '.');
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
};