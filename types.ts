export enum Incoterm {
  FOB = 'FOB',
  CFR = 'CFR',
  CIF = 'CIF',
  DAP = 'DAP',
  EXW = 'EXW'
}

export enum Regime {
  ONLY_023 = '023',
  MIXED_312 = '023+312',
  MIXED_311 = '023+311'
}

export interface Article {
  id: number;
  designation?: string;
  poidsBrut: number;
  poidsNet: number;
  valeurEUR: number;
  fretEUR?: number; 
  fretMAD?: number; 
}

export interface GlobalLogistics {
  fretGlobalEUR: number;
  fretGlobalMAD: number;
  assuranceTaux: number; 
  royaltiesMAD: number;
  tauxEurMad: number;
}

export interface ArticleResult {
  id: number;
  designation: string;
  valeurEUR: number;
  contreValeurMAD: number;
  fretProRataMAD: number;
  assuranceMAD: number;
  partRoyaltiesMAD: number;
  valeurDouaneArticle: number;
}

export interface RegimeDetail {
  valeurEUR: number;
  valeurMAD: number;
  poidsBrut: number;
  poidsNet: number;
  fretMAD: number;
  assuranceMAD: number;
  royaltiesMAD: number;
  valeurDouaneTotal: number;
}

export interface CalculationResult {
  totalValeurEUR: number;
  totalValeurMAD: number;
  totalPoidsBrut: number;
  totalPoidsNet: number;
  totalFretMAD: number;
  totalAssuranceMAD: number;
  totalRoyaltiesMAD: number;
  totalValeurDouane: number;
  perArticle: ArticleResult[];
  perArticle023: ArticleResult[];
  perArticleAT: ArticleResult[];
  regime023: RegimeDetail;
  regimeSecondary?: RegimeDetail;
}