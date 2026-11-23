import { Article, Incoterm, Regime, CalculationResult, ArticleResult, RegimeDetail, GlobalLogistics } from '../types';

export const calculateCustoms = (
  articles023: Article[],
  regime: Regime,
  incoterm: Incoterm,
  logistics: GlobalLogistics,
  articlesAT: Article[] = []
): CalculationResult => {
  const { fretGlobalMAD, assuranceTaux, royaltiesMAD, tauxEurMad } = logistics;

  const has023 = regime !== Regime.ONLY_311;
  const hasAT = regime !== Regime.ONLY_023;

  const activeArticles023 = has023 ? articles023 : [];
  const activeArticlesAT = hasAT ? articlesAT : [];

  const isCFR = incoterm === Incoterm.CFR;
  const isCIF = incoterm === Incoterm.CIF;
  const isDAT = incoterm === Incoterm.DAT;

  const hasFreightInForm =
    incoterm === Incoterm.FOB ||
    incoterm === Incoterm.EXW ||
    incoterm === Incoterm.DAP ||
    isCFR;
  const excludeFretFromVD = isCFR || isCIF || isDAT;
  const hasAcconage = !isDAT;

  const totalPb023 = activeArticles023.reduce((sum, a) => sum + (a.poidsBrut || 0), 0);
  const totalPbAT = activeArticlesAT.reduce((sum, a) => sum + (a.poidsBrut || 0), 0);
  const globalPb = totalPb023 + totalPbAT;

  const totalPbForProRata = [...activeArticles023, ...activeArticlesAT]
    .filter(a => !(a.fretEUR && a.fretEUR > 0))
    .reduce((sum, a) => sum + (a.poidsBrut || 0), 0);

  const fretPerKg = hasFreightInForm && totalPbForProRata > 0 ? fretGlobalMAD / totalPbForProRata : 0;
  const royaltiesPerKg = hasAcconage && globalPb > 0 ? royaltiesMAD / globalPb : 0;

  const processArticleList = (list: Article[]): ArticleResult[] => {
    return list.map(art => {
      const cvMAD = (art.valeurEUR || 0) * tauxEurMad;

      let fretArtMAD = 0;
      if (hasFreightInForm) {
        if (art.fretEUR && art.fretEUR > 0) {
          fretArtMAD = art.fretEUR * tauxEurMad;
        } else {
          fretArtMAD = (art.poidsBrut || 0) * fretPerKg;
        }
      }

      const royaltiesArtMAD = hasAcconage ? (art.poidsBrut || 0) * royaltiesPerKg : 0;
      const fretForVD = excludeFretFromVD ? 0 : fretArtMAD;

      let baseAssurance = 0;
      let assuranceArtMAD = 0;
      let vdArt = 0;

      if (isDAT) {
        baseAssurance = cvMAD;
        assuranceArtMAD = baseAssurance * (assuranceTaux / 100);
        vdArt = cvMAD + assuranceArtMAD;
      } else if (isCFR || isCIF) {
        baseAssurance = cvMAD;
        assuranceArtMAD = baseAssurance * (assuranceTaux / 100);
        vdArt = cvMAD + assuranceArtMAD + royaltiesArtMAD;
      } else {
        baseAssurance = cvMAD + fretForVD;
        assuranceArtMAD = baseAssurance * (assuranceTaux / 100);
        vdArt = cvMAD + fretForVD + assuranceArtMAD + royaltiesArtMAD;
      }

      return {
        id: art.id,
        designation: art.designation?.trim() || `Article #${art.id}`,
        poidsBrut: art.poidsBrut || 0,
        valeurEUR: art.valeurEUR || 0,
        contreValeurMAD: cvMAD,
        fretProRataMAD: fretArtMAD,
        assuranceMAD: assuranceArtMAD,
        partRoyaltiesMAD: royaltiesArtMAD,
        valeurDouaneArticle: vdArt
      };
    });
  };

  const perArticle023 = has023 ? processArticleList(activeArticles023) : [];
  const perArticleAT = hasAT ? processArticleList(activeArticlesAT) : [];

  const aggregateRegime = (results: ArticleResult[], original: Article[]): RegimeDetail => {
    return {
      valeurEUR: original.reduce((sum, a) => sum + (a.valeurEUR || 0), 0),
      valeurMAD: results.reduce((sum, r) => sum + r.contreValeurMAD, 0),
      poidsBrut: original.reduce((sum, a) => sum + (a.poidsBrut || 0), 0),
      poidsNet: original.reduce((sum, a) => sum + (a.poidsNet || 0), 0),
      fretMAD: results.reduce((sum, r) => sum + (excludeFretFromVD ? 0 : r.fretProRataMAD), 0),
      assuranceMAD: results.reduce((sum, r) => sum + r.assuranceMAD, 0),
      royaltiesMAD: results.reduce((sum, r) => sum + r.partRoyaltiesMAD, 0),
      valeurDouaneTotal: results.reduce((sum, r) => sum + r.valeurDouaneArticle, 0)
    };
  };

  const regime023 = has023 ? aggregateRegime(perArticle023, activeArticles023) : undefined;
  const regimeAT = hasAT ? aggregateRegime(perArticleAT, activeArticlesAT) : undefined;

  return {
    incoterm,
    tauxEurMad,
    assuranceTaux,
    totalValeurEUR: (regime023?.valeurEUR || 0) + (regimeAT?.valeurEUR || 0),
    totalValeurMAD: (regime023?.valeurMAD || 0) + (regimeAT?.valeurMAD || 0),
    totalPoidsBrut: globalPb,
    totalPoidsNet:
      activeArticles023.reduce((sum, a) => sum + (a.poidsNet || 0), 0) +
      activeArticlesAT.reduce((sum, a) => sum + (a.poidsNet || 0), 0),
    totalFretMAD: (regime023?.fretMAD || 0) + (regimeAT?.fretMAD || 0),
    totalAssuranceMAD: (regime023?.assuranceMAD || 0) + (regimeAT?.assuranceMAD || 0),
    totalRoyaltiesMAD: (regime023?.royaltiesMAD || 0) + (regimeAT?.royaltiesMAD || 0),
    totalValeurDouane: (regime023?.valeurDouaneTotal || 0) + (regimeAT?.valeurDouaneTotal || 0),
    perArticle: [...perArticle023, ...perArticleAT],
    perArticle023,
    perArticleAT,
    regime023,
    regimeAT
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
  const sanitized = val.toString().replace(/\s+/g, '').replace(',', '.');
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
};