import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  FileDown,
  RotateCcw,
  Play,
  Info,
  Package,
  TrendingUp,
  Layers,
  Coins,
  RefreshCw
} from 'lucide-react';
import {
  Article,
  Incoterm,
  Regime,
  GlobalLogistics,
  CalculationResult
} from './types';
import {
  calculateCustoms,
  formatCurrency,
  formatDecimal,
  formatRounded,
  sanitizeNumericInput
} from './utils/calculations';
import { generatePDFReport } from './utils/pdfGenerator';
import { DesignationCombobox } from './components/DesignationCombobox';
import { fetchLiveEurMadRate } from './utils/exchangeRate';

interface TabColorTheme {
  active: string;
  inactive: string;
  subActive: string;
  subInactive: string;
  okActive: string;
  okInactive: string;
}

interface IncotermMeta {
  code: Incoterm;
  label: string;
  formula: string;
  description: string;
  showFreight: boolean;
  showAcconage: boolean;
  showAssurance: boolean;
  defaultAssuranceTaux: number;
  defaultRoyaltiesMAD: number;
  weightLabel: string;
  theme: TabColorTheme;
}

const INCOTERM_CONFIGS: Record<Incoterm, IncotermMeta> = {
  [Incoterm.FOB]: {
    code: Incoterm.FOB,
    label: 'Free On Board',
    formula: 'VD = (Valeur € × Taux) + Fret + Assurance (0,5% sur CV + Fret) + Acconage',
    description:
      'Le fret maritime, l’assurance et l’acconage sont intégrés à la Valeur en Douane.',
    showFreight: true,
    showAcconage: true,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 2300,
    weightLabel: 'Brut (KG)',
    theme: {
      active: 'bg-blue-700 text-white border-blue-700 shadow-sm',
      inactive: 'bg-blue-50/70 text-blue-950 border-blue-200/80 hover:bg-blue-100/70',
      subActive: 'text-blue-100',
      subInactive: 'text-blue-700/75',
      okActive: 'text-amber-200',
      okInactive: 'text-blue-700'
    }
  },
  [Incoterm.CFR]: {
    code: Incoterm.CFR,
    label: 'Cost and Freight',
    formula: 'VD = (Valeur € × Taux) + Assurance (0,5% sur CV) + Acconage · Fret exclu',
    description:
      'Le fret est déjà inclus dans la valeur facture et reste exclu du calcul de la VD.',
    showFreight: true,
    showAcconage: true,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 2300,
    weightLabel: 'Net (KG)',
    theme: {
      active: 'bg-amber-600 text-white border-amber-600 shadow-sm',
      inactive: 'bg-amber-50/70 text-amber-950 border-amber-200/80 hover:bg-amber-100/70',
      subActive: 'text-amber-100',
      subInactive: 'text-amber-800/75',
      okActive: 'text-white',
      okInactive: 'text-amber-700'
    }
  },
  [Incoterm.CIF]: {
    code: Incoterm.CIF,
    label: 'Cost, Insurance & Freight',
    formula: 'VD = (Valeur € × Taux) + Fret + Assurance (0,5% sur CV + Fret) + Acconage',
    description:
      'Calcul standard avec fret, assurance (0,5% par défaut) et acconage. Laissez le fret à 0 s’il est déjà inclus dans la facture.',
    showFreight: true,
    showAcconage: true,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 2300,
    weightLabel: 'Brut (KG)',
    theme: {
      active: 'bg-teal-700 text-white border-teal-700 shadow-sm',
      inactive: 'bg-teal-50/70 text-teal-950 border-teal-200/80 hover:bg-teal-100/70',
      subActive: 'text-teal-100',
      subInactive: 'text-teal-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-teal-700'
    }
  },
  [Incoterm.DAP]: {
    code: Incoterm.DAP,
    label: 'Delivered at Place',
    formula: 'VD = (Valeur € × Taux) + Fret (si applicable) + Assurance (0,5%) + Acconage',
    description:
      'Livré au lieu convenu. Laissez le fret à 0 s’il est déjà compris dans le prix facture.',
    showFreight: true,
    showAcconage: true,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 2300,
    weightLabel: 'Brut (KG)',
    theme: {
      active: 'bg-indigo-700 text-white border-indigo-700 shadow-sm',
      inactive: 'bg-indigo-50/70 text-indigo-950 border-indigo-200/80 hover:bg-indigo-100/70',
      subActive: 'text-indigo-100',
      subInactive: 'text-indigo-700/75',
      okActive: 'text-amber-200',
      okInactive: 'text-indigo-700'
    }
  },
  [Incoterm.EXW]: {
    code: Incoterm.EXW,
    label: 'Ex Works',
    formula: 'VD = (Valeur € × Taux) + Fret / Transport + Assurance (0,5% sur CV + Fret) + Acconage',
    description:
      'Départ usine : tous les frais de transport, assurance et acconage s’ajoutent à la VD.',
    showFreight: true,
    showAcconage: true,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 2300,
    weightLabel: 'Brut (KG)',
    theme: {
      active: 'bg-slate-700 text-white border-slate-700 shadow-sm',
      inactive: 'bg-slate-100/80 text-slate-900 border-slate-300/80 hover:bg-slate-200/70',
      subActive: 'text-slate-200',
      subInactive: 'text-slate-600',
      okActive: 'text-amber-300',
      okInactive: 'text-slate-700'
    }
  },
  [Incoterm.DAT]: {
    code: Incoterm.DAT,
    label: 'Delivered at Terminal',
    formula: 'VD = (Valeur € × Taux) + Assurance (Valeur € × Taux × 0,5%) · Sans Acconage',
    description:
      'Rendu au terminal : calcul basé uniquement sur la contre-valeur et l’assurance (0,5%), sans fret ni acconage.',
    showFreight: false,
    showAcconage: false,
    showAssurance: true,
    defaultAssuranceTaux: 0.5,
    defaultRoyaltiesMAD: 0,
    weightLabel: 'Brut (KG)',
    theme: {
      active: 'bg-emerald-700 text-white border-emerald-700 shadow-sm',
      inactive: 'bg-emerald-50/70 text-emerald-950 border-emerald-200/80 hover:bg-emerald-100/70',
      subActive: 'text-emerald-100',
      subInactive: 'text-emerald-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-emerald-700'
    }
  }
};

interface RegimeMeta {
  code: Regime;
  label: string;
  subtitle: string;
  theme: TabColorTheme;
}

const REGIME_CONFIGS: Record<Regime, RegimeMeta> = {
  [Regime.ONLY_023]: {
    code: Regime.ONLY_023,
    label: 'DUM 023',
    subtitle: 'Mise à la consommation unique',
    theme: {
      active: 'bg-sky-700 text-white border-sky-700 shadow-sm',
      inactive: 'bg-sky-50/70 text-sky-950 border-sky-200/80 hover:bg-sky-100/70',
      subActive: 'text-sky-100',
      subInactive: 'text-sky-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-sky-700'
    }
  },
  [Regime.ONLY_311]: {
    code: Regime.ONLY_311,
    label: 'DUM 311 (AT)',
    subtitle: 'Admission temporaire seule (sans 023)',
    theme: {
      active: 'bg-emerald-700 text-white border-emerald-700 shadow-sm',
      inactive: 'bg-emerald-50/70 text-emerald-950 border-emerald-200/80 hover:bg-emerald-100/70',
      subActive: 'text-emerald-100',
      subInactive: 'text-emerald-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-emerald-700'
    }
  },
  [Regime.MIXED_312]: {
    code: Regime.MIXED_312,
    label: '023 + 312 (AT)',
    subtitle: 'Consommation + AT Emballage',
    theme: {
      active: 'bg-violet-700 text-white border-violet-700 shadow-sm',
      inactive: 'bg-violet-50/70 text-violet-950 border-violet-200/80 hover:bg-violet-100/70',
      subActive: 'text-violet-100',
      subInactive: 'text-violet-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-violet-700'
    }
  },
  [Regime.MIXED_311]: {
    code: Regime.MIXED_311,
    label: '023 + 311 (AT)',
    subtitle: 'Consommation + Admission temporaire',
    theme: {
      active: 'bg-cyan-700 text-white border-cyan-700 shadow-sm',
      inactive: 'bg-cyan-50/70 text-cyan-950 border-cyan-200/80 hover:bg-cyan-100/70',
      subActive: 'text-cyan-100',
      subInactive: 'text-cyan-800/75',
      okActive: 'text-amber-200',
      okInactive: 'text-cyan-700'
    }
  }
};

const INCOTERM_ORDER: Incoterm[] = [
  Incoterm.FOB,
  Incoterm.CFR,
  Incoterm.CIF,
  Incoterm.DAP,
  Incoterm.EXW,
  Incoterm.DAT
];

const REGIME_ORDER: Regime[] = [
  Regime.ONLY_023,
  Regime.ONLY_311,
  Regime.MIXED_312,
  Regime.MIXED_311
];

const DEFAULT_EUR_MAD = 10.85;
const TAUX_STORAGE_KEY = 'douane_maroc_taux_eur_mad_v1';
const SAVED_PRODUCTS_STORAGE_KEY = 'douane_maroc_saved_designations_v2';
const LEGACY_SAVED_PRODUCTS_STORAGE_KEY = 'douane_maroc_saved_designations_v1';

const DEFAULT_PRODUCTS: string[] = [
  'ANCHOIS EN SAUMURE',
  'ANCHOIS FRAIS',
  'CREVETTES NON DECORTIQUEES FRAIS',
  'CREVETTES NON DECORTIQUEES CONGELES',
  'CAISSES EN P.V.C',
  'PALETTES EN P.V.C',
  'PALETTES EN BOIS',
  'FUTS EN PLATSIQUES',
  'SEAUX',
  'BANDEJAS',
  'SACS EN PLASTIQUES',
  'BOBINAS',
  'CARTONS',
  'CONSERVATEUR',
  'ACIDE CITRIQUE'
];

const createInitialArticle = (id: number): Article => ({
  id,
  designation: '',
  poidsBrut: 0,
  poidsNet: 0,
  valeurEUR: 0,
  fretEUR: 0
});

interface RegimeFormState {
  logistics: GlobalLogistics;
  articles023: Article[];
  articlesAT: Article[];
  rawInputs: Record<string, string>;
  result: CalculationResult | null;
}

const createInitialRegimeState = (
  incoterm: Incoterm,
  tauxEurMad: number = DEFAULT_EUR_MAD
): RegimeFormState => {
  const cfg = INCOTERM_CONFIGS[incoterm];
  return {
    logistics: {
      fretGlobalEUR: 0,
      fretGlobalMAD: 0,
      assuranceTaux: cfg.defaultAssuranceTaux,
      royaltiesMAD: cfg.defaultRoyaltiesMAD,
      tauxEurMad
    },
    articles023: [createInitialArticle(1)],
    articlesAT: [createInitialArticle(1)],
    rawInputs: {
      'log-royaltiesMAD': cfg.defaultRoyaltiesMAD.toString(),
      'log-assuranceTaux': cfg.defaultAssuranceTaux.toString().replace('.', ','),
      'log-fretGlobalEUR': '0',
      'log-fretGlobalMAD': '0'
    },
    result: null
  };
};

const createInitialIncotermRegimes = (
  incoterm: Incoterm,
  tauxEurMad: number = DEFAULT_EUR_MAD
): Record<Regime, RegimeFormState> => ({
  [Regime.ONLY_023]: createInitialRegimeState(incoterm, tauxEurMad),
  [Regime.ONLY_311]: createInitialRegimeState(incoterm, tauxEurMad),
  [Regime.MIXED_312]: createInitialRegimeState(incoterm, tauxEurMad),
  [Regime.MIXED_311]: createInitialRegimeState(incoterm, tauxEurMad)
});

interface ArticleTableCardProps {
  type: '023' | 'AT';
  title: string;
  list: Article[];
  config: IncotermMeta;
  totalGlobalPb: number;
  logistics: GlobalLogistics;
  rawInputs: Record<string, string>;
  savedProducts: string[];
  onRemoveSavedProduct: (product: string) => void;
  onUpdate: (type: '023' | 'AT', id: number, field: keyof Article, value: string) => void;
  onRemove: (type: '023' | 'AT', id: number) => void;
  onAdd: (type: '023' | 'AT') => void;
}

const ArticleTableCard: React.FC<ArticleTableCardProps> = ({
  type,
  title,
  list,
  config,
  totalGlobalPb,
  logistics,
  rawInputs,
  savedProducts,
  onRemoveSavedProduct,
  onUpdate,
  onRemove,
  onAdd
}) => {
  const isAT = type === 'AT';
  const isDAT = config.code === Incoterm.DAT;
  const isCFR = config.code === Incoterm.CFR;

  return (
    <section className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 rounded-t-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {isAT ? (
            <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <Layers className="w-4 h-4 text-blue-900 shrink-0" />
          )}
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
          <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
            · {list.length} {list.length > 1 ? 'articles' : 'article'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(type)}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isAT
              ? 'bg-emerald-700 hover:bg-emerald-800'
              : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter article
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {list.map((art, idx) => {
          const cvMAD = (art.valeurEUR || 0) * (logistics.tauxEurMad || 0);
          const assuranceArt = cvMAD * ((logistics.assuranceTaux || 0) / 100);
          const acconageArt =
            config.showAcconage && totalGlobalPb > 0
              ? (logistics.royaltiesMAD / totalGlobalPb) * (art.poidsBrut || 0)
              : 0;
          const vdDatPreview = cvMAD + assuranceArt;

          return (
            <div
              key={art.id}
              className="p-4 hover:bg-slate-50/60 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className={isDAT ? 'md:col-span-4' : config.showFreight ? 'md:col-span-3' : 'md:col-span-4'}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Désignation #{idx + 1}
                  </label>
                  <DesignationCombobox
                    value={art.designation || ''}
                    savedProducts={savedProducts}
                    onChange={val => onUpdate(type, art.id, 'designation', val)}
                    onRemoveSavedProduct={onRemoveSavedProduct}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Valeur (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawInputs[`${type}-${art.id}-valeurEUR`] ?? (art.valeurEUR ? art.valeurEUR.toString() : '')}
                    onChange={e => onUpdate(type, art.id, 'valeurEUR', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                    placeholder="0,00"
                  />
                </div>

                {config.showFreight && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isCFR ? 'Fret réf. (€)' : 'Fret (€)'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rawInputs[`${type}-${art.id}-fretEUR`] ?? (art.fretEUR ? art.fretEUR.toString() : '')}
                      onChange={e => onUpdate(type, art.id, 'fretEUR', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                      placeholder="Auto"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {config.weightLabel}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawInputs[`${type}-${art.id}-poidsBrut`] ?? (art.poidsBrut ? art.poidsBrut.toString() : '')}
                    onChange={e => onUpdate(type, art.id, 'poidsBrut', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                    placeholder="0"
                  />
                </div>

                {isDAT ? (
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Assurance {formatDecimal(logistics.assuranceTaux, 2)}% · VD Estimée
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-700 flex items-center justify-between gap-2">
                      <span>{formatRounded(assuranceArt)} DH</span>
                      <span className="font-semibold text-blue-900">{formatRounded(vdDatPreview)} DH</span>
                    </div>
                  </div>
                ) : (
                  <div className={config.showFreight ? 'md:col-span-2' : 'md:col-span-3'}>
                    <label className="block text-xs font-medium text-emerald-700 mb-1">
                      Acconage (DH)
                    </label>
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-medium text-emerald-800 truncate">
                      {formatRounded(acconageArt)} DH
                    </div>
                  </div>
                )}

                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onRemove(type, art.id)}
                    disabled={list.length <= 1}
                    className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
                    title="Supprimer l'article"
                    aria-label="Supprimer l'article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const App: React.FC = () => {
  const [activeIncoterm, setActiveIncoterm] = useState<Incoterm>(Incoterm.FOB);
  const [activeRegimeByIncoterm, setActiveRegimeByIncoterm] = useState<Record<Incoterm, Regime>>({
    [Incoterm.FOB]: Regime.ONLY_023,
    [Incoterm.CFR]: Regime.ONLY_023,
    [Incoterm.CIF]: Regime.ONLY_023,
    [Incoterm.DAP]: Regime.ONLY_023,
    [Incoterm.EXW]: Regime.ONLY_023,
    [Incoterm.DAT]: Regime.ONLY_023
  });

  const [hadSavedRateOnMount] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(TAUX_STORAGE_KEY);
      return !!(saved && saved.trim().length > 0);
    } catch {
      return false;
    }
  });

  const [globalTauxInput, setGlobalTauxInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(TAUX_STORAGE_KEY);
      if (saved && saved.trim().length > 0) return saved;
    } catch {
      // Ignore storage read errors
    }
    return DEFAULT_EUR_MAD.toString().replace('.', ',');
  });
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateMeta, setRateMeta] = useState<{ dateLabel: string; source: string } | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  const globalTauxEurMad = useMemo(
    () => sanitizeNumericInput(globalTauxInput),
    [globalTauxInput]
  );

  useEffect(() => {
    try {
      localStorage.setItem(TAUX_STORAGE_KEY, globalTauxInput);
    } catch {
      // Ignore storage write errors
    }
  }, [globalTauxInput]);

  const [tabStates, setTabStates] = useState<Record<Incoterm, Record<Regime, RegimeFormState>>>(() => {
    let initialTaux = DEFAULT_EUR_MAD;
    try {
      const saved = localStorage.getItem(TAUX_STORAGE_KEY);
      if (saved && saved.trim().length > 0) initialTaux = sanitizeNumericInput(saved);
    } catch {
      // Ignore storage read errors
    }
    return {
      [Incoterm.FOB]: createInitialIncotermRegimes(Incoterm.FOB, initialTaux),
      [Incoterm.CFR]: createInitialIncotermRegimes(Incoterm.CFR, initialTaux),
      [Incoterm.CIF]: createInitialIncotermRegimes(Incoterm.CIF, initialTaux),
      [Incoterm.DAP]: createInitialIncotermRegimes(Incoterm.DAP, initialTaux),
      [Incoterm.EXW]: createInitialIncotermRegimes(Incoterm.EXW, initialTaux),
      [Incoterm.DAT]: createInitialIncotermRegimes(Incoterm.DAT, initialTaux)
    };
  });

  const [savedProducts, setSavedProducts] = useState<string[]>(() => {
    try {
      const rawV2 = localStorage.getItem(SAVED_PRODUCTS_STORAGE_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      }

      const merged: string[] = [...DEFAULT_PRODUCTS];
      const rawV1 = localStorage.getItem(LEGACY_SAVED_PRODUCTS_STORAGE_KEY);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1);
        if (Array.isArray(parsedV1)) {
          for (const item of parsedV1) {
            if (typeof item === 'string' && item.trim().length > 0) {
              const trimmed = item.trim();
              if (!merged.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
                merged.unshift(trimmed);
              }
            }
          }
        }
      }
      return merged;
    } catch {
      return [...DEFAULT_PRODUCTS];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify(savedProducts));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedProducts]);

  const activeRegime = activeRegimeByIncoterm[activeIncoterm];
  const currentTab = tabStates[activeIncoterm][activeRegime];
  const config = INCOTERM_CONFIGS[activeIncoterm];
  const regimeConfig = REGIME_CONFIGS[activeRegime];
  const { logistics, articles023, articlesAT, rawInputs, result } = currentTab;

  const has023 = activeRegime !== Regime.ONLY_311;
  const hasAT = activeRegime !== Regime.ONLY_023;
  const isCFR = activeIncoterm === Incoterm.CFR;
  const isDAT = activeIncoterm === Incoterm.DAT;
  const isCIF = activeIncoterm === Incoterm.CIF;

  const totalGlobalPb = useMemo(() => {
    const pb023 = has023 ? articles023.reduce((sum, a) => sum + (a.poidsBrut || 0), 0) : 0;
    const pbAT = hasAT ? articlesAT.reduce((sum, a) => sum + (a.poidsBrut || 0), 0) : 0;
    return pb023 + pbAT;
  }, [articles023, articlesAT, has023, hasAT]);

  const persistUsedDesignations = useCallback((items: Article[]) => {
    const newNames = items
      .map(item => (item.designation || '').trim())
      .filter(name => name.length > 0);
    if (newNames.length === 0) return;

    setSavedProducts(prev => {
      const merged = [...prev];
      for (const name of newNames) {
        const existingIdx = merged.findIndex(p => p.toLowerCase() === name.toLowerCase());
        if (existingIdx !== -1) {
          merged.splice(existingIdx, 1);
        }
        merged.unshift(name);
      }
      return merged;
    });
  }, []);

  const handleRemoveSavedProduct = useCallback((product: string) => {
    setSavedProducts(prev => prev.filter(p => p.toLowerCase() !== product.toLowerCase()));
  }, []);

  const updateRegimeState = useCallback(
    (incoterm: Incoterm, regime: Regime, updater: (prev: RegimeFormState) => RegimeFormState) => {
      setTabStates(prev => {
        const nextRegimeState = updater(prev[incoterm][regime]);
        nextRegimeState.logistics = {
          ...nextRegimeState.logistics,
          tauxEurMad: globalTauxEurMad
        };
        if (nextRegimeState.result !== null) {
          nextRegimeState.result = calculateCustoms(
            nextRegimeState.articles023,
            regime,
            incoterm,
            nextRegimeState.logistics,
            nextRegimeState.articlesAT
          );
        }
        return {
          ...prev,
          [incoterm]: {
            ...prev[incoterm],
            [regime]: nextRegimeState
          }
        };
      });
    },
    [globalTauxEurMad]
  );

  const handleGlobalTauxChange = useCallback((rawValue: string) => {
    setGlobalTauxInput(rawValue);
    setRateError(null);
    const nextTaux = sanitizeNumericInput(rawValue);

    setTabStates(prev => {
      const next = { ...prev };
      for (const inc of INCOTERM_ORDER) {
        const nextRegimes = { ...prev[inc] };
        for (const reg of REGIME_ORDER) {
          const tab = prev[inc][reg];
          const madVal = Number(((tab.logistics.fretGlobalEUR || 0) * nextTaux).toFixed(2));
          const updatedLogistics: GlobalLogistics = {
            ...tab.logistics,
            tauxEurMad: nextTaux,
            fretGlobalMAD: madVal
          };
          const updatedRawInputs = {
            ...tab.rawInputs,
            'log-fretGlobalMAD': madVal.toString().replace('.', ',')
          };
          const updatedResult =
            tab.result !== null
              ? calculateCustoms(tab.articles023, reg, inc, updatedLogistics, tab.articlesAT)
              : null;

          nextRegimes[reg] = {
            ...tab,
            logistics: updatedLogistics,
            rawInputs: updatedRawInputs,
            result: updatedResult
          };
        }
        next[inc] = nextRegimes;
      }
      return next;
    });
  }, []);

  const handleFetchDailyRate = useCallback(async () => {
    setIsFetchingRate(true);
    setRateError(null);
    try {
      const live = await fetchLiveEurMadRate();
      const formatted = live.rate.toFixed(4).replace('.', ',');
      handleGlobalTauxChange(formatted);
      setRateMeta({ dateLabel: live.dateLabel, source: live.source });
    } catch {
      setRateError('Connexion impossible pour récupérer le taux du jour.');
    } finally {
      setIsFetchingRate(false);
    }
  }, [handleGlobalTauxChange]);

  useEffect(() => {
    if (!hadSavedRateOnMount) {
      void handleFetchDailyRate();
    }
  }, [hadSavedRateOnMount, handleFetchDailyRate]);

  const handleCalculate = useCallback(() => {
    const activeArticles = [
      ...(has023 ? currentTab.articles023 : []),
      ...(hasAT ? currentTab.articlesAT : [])
    ];
    persistUsedDesignations(activeArticles);

    setTabStates(prev => {
      const tab = prev[activeIncoterm][activeRegime];
      const syncedLogistics = { ...tab.logistics, tauxEurMad: globalTauxEurMad };
      const calculated = calculateCustoms(
        tab.articles023,
        activeRegime,
        activeIncoterm,
        syncedLogistics,
        tab.articlesAT
      );
      return {
        ...prev,
        [activeIncoterm]: {
          ...prev[activeIncoterm],
          [activeRegime]: { ...tab, logistics: syncedLogistics, result: calculated }
        }
      };
    });
  }, [activeIncoterm, activeRegime, currentTab, globalTauxEurMad, has023, hasAT, persistUsedDesignations]);

  const handleReset = useCallback(() => {
    setTabStates(prev => ({
      ...prev,
      [activeIncoterm]: {
        ...prev[activeIncoterm],
        [activeRegime]: createInitialRegimeState(activeIncoterm, globalTauxEurMad)
      }
    }));
  }, [activeIncoterm, activeRegime, globalTauxEurMad]);

  const setActiveRegime = (nextRegime: Regime) => {
    setActiveRegimeByIncoterm(prev => ({ ...prev, [activeIncoterm]: nextRegime }));
  };

  const addArticle = (type: '023' | 'AT') => {
    updateRegimeState(activeIncoterm, activeRegime, prev => {
      const list = type === '023' ? prev.articles023 : prev.articlesAT;
      const nextId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
      const updatedList = [...list, createInitialArticle(nextId)];
      return type === '023'
        ? { ...prev, articles023: updatedList }
        : { ...prev, articlesAT: updatedList };
    });
  };

  const removeArticle = (type: '023' | 'AT', id: number) => {
    updateRegimeState(activeIncoterm, activeRegime, prev => {
      const list = type === '023' ? prev.articles023 : prev.articlesAT;
      if (list.length <= 1) return prev;
      const updatedList = list.filter(a => a.id !== id);
      return type === '023'
        ? { ...prev, articles023: updatedList }
        : { ...prev, articlesAT: updatedList };
    });
  };

  const updateArticle = (
    type: '023' | 'AT',
    id: number,
    field: keyof Article,
    value: string
  ) => {
    const inputKey = `${type}-${id}-${field}`;
    updateRegimeState(activeIncoterm, activeRegime, prev => {
      const list = type === '023' ? prev.articles023 : prev.articlesAT;
      const nextRawInputs = { ...prev.rawInputs, [inputKey]: value };
      const updatedList =
        field === 'designation'
          ? list.map(a => (a.id === id ? { ...a, designation: value } : a))
          : list.map(a => (a.id === id ? { ...a, [field]: sanitizeNumericInput(value) } : a));

      return type === '023'
        ? { ...prev, rawInputs: nextRawInputs, articles023: updatedList }
        : { ...prev, rawInputs: nextRawInputs, articlesAT: updatedList };
    });
  };

  const updateLogistics = (field: keyof GlobalLogistics, rawValue: string) => {
    const inputKey = `log-${field}`;
    const val = sanitizeNumericInput(rawValue);

    updateRegimeState(activeIncoterm, activeRegime, prev => {
      const nextInputs = { ...prev.rawInputs, [inputKey]: rawValue };
      const nextLogistics = { ...prev.logistics, tauxEurMad: globalTauxEurMad, [field]: val };

      if (field === 'fretGlobalEUR') {
        const madVal = Number((val * globalTauxEurMad).toFixed(2));
        nextLogistics.fretGlobalMAD = madVal;
        nextInputs['log-fretGlobalMAD'] = madVal.toString().replace('.', ',');
      } else if (field === 'fretGlobalMAD') {
        const eurVal =
          globalTauxEurMad > 0
            ? Number((val / globalTauxEurMad).toFixed(2))
            : 0;
        nextLogistics.fretGlobalEUR = eurVal;
        nextInputs['log-fretGlobalEUR'] = eurVal.toString().replace('.', ',');
      }

      return {
        ...prev,
        rawInputs: nextInputs,
        logistics: nextLogistics
      };
    });
  };

  const atLabelShort = activeRegime === Regime.MIXED_312 ? 'DUM 312 (AT)' : 'DUM 311 (AT)';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: clean single-row bar */}
      <header className="bg-[#1e3a8a] text-white border-b border-blue-950/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <Calculator className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-base font-bold tracking-tight">
              Douane Maroc Calculator
            </span>
          </div>

          <nav
            aria-label="Incoterms"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-blue-100"
          >
            {INCOTERM_ORDER.map(inc => (
              <button
                key={inc}
                type="button"
                onClick={() => setActiveIncoterm(inc)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeIncoterm === inc
                    ? 'border-amber-400 text-white font-semibold'
                    : 'border-transparent text-blue-200 hover:text-white'
                }`}
              >
                {inc}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => result && generatePDFReport(result, activeRegime, activeIncoterm)}
              disabled={!result}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Exporter PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Global Exchange Rate Bar (shared across all Incoterms & Régimes) */}
        <section
          aria-label="Taux de change global"
          className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <label
                htmlFor="global-taux-eur-mad"
                className="block text-sm font-bold text-slate-900"
              >
                Taux de change Global (EUR / MAD)
              </label>
              <p className="text-xs text-slate-500">
                Appliqué à tous les onglets Incoterms · conservé lors du changement d’onglet.
                {rateMeta && (
                  <span className="ml-1.5 text-emerald-700 font-medium">
                    · Taux du {rateMeta.dateLabel} ({rateMeta.source})
                  </span>
                )}
              </p>
              {rateError && (
                <p className="text-xs text-rose-600 mt-0.5">{rateError}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative w-44">
              <input
                id="global-taux-eur-mad"
                type="text"
                inputMode="decimal"
                value={globalTauxInput}
                onChange={e => handleGlobalTauxChange(e.target.value)}
                className="w-full bg-amber-50/40 border border-amber-300 rounded-lg pl-3.5 pr-12 py-2.5 text-base font-mono tabular-nums font-bold text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                placeholder="10,85"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-500 pointer-events-none">
                MAD
              </span>
            </div>

            <button
              type="button"
              onClick={handleFetchDailyRate}
              disabled={isFetchingRate}
              className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRate ? 'animate-spin' : ''}`} />
              {isFetchingRate ? 'Chargement...' : 'Taux du jour'}
            </button>
          </div>
        </section>

        {/* Level 1: Incoterm Tabs + Level 2: Régime Douanier Sub-Tabs under each Incoterm */}
        <section aria-label="Sélection de l'Incoterm et du Régime" className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {config.code} ({config.label}) · {regimeConfig.label}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {config.description}
              </p>
            </div>
            <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {config.formula}
            </div>
          </div>

          {/* Incoterm Tab Bar */}
          <div
            role="tablist"
            aria-label="Onglets Incoterms"
            className="grid grid-cols-3 sm:grid-cols-6 gap-2.5"
          >
            {INCOTERM_ORDER.map(inc => {
              const item = INCOTERM_CONFIGS[inc];
              const isSelected = activeIncoterm === inc;
              const anyResultInIncoterm = REGIME_ORDER.some(
                reg => tabStates[inc][reg].result !== null
              );
              return (
                <button
                  key={inc}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  onClick={() => setActiveIncoterm(inc)}
                  className={`px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected ? item.theme.active : item.theme.inactive
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                      {item.code}
                    </span>
                    {anyResultInIncoterm && (
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          isSelected ? item.theme.okActive : item.theme.okInactive
                        }`}
                      >
                        OK
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs truncate mt-0.5 ${
                      isSelected ? item.theme.subActive : item.theme.subInactive
                    }`}
                  >
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Régime Douanier Sub-Tabs under active Incoterm */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Régime Douanier — {activeIncoterm}
              </span>
              <span className="text-xs text-slate-400">
                {regimeConfig.subtitle}
              </span>
            </div>
            <div
              role="tablist"
              aria-label={`Régimes douaniers pour ${activeIncoterm}`}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              {REGIME_ORDER.map(reg => {
                const regMeta = REGIME_CONFIGS[reg];
                const isSelected = activeRegime === reg;
                const hasRegResult = tabStates[activeIncoterm][reg].result !== null;
                return (
                  <button
                    key={reg}
                    role="tab"
                    type="button"
                    aria-selected={isSelected}
                    onClick={() => setActiveRegime(reg)}
                    className={`px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected ? regMeta.theme.active : regMeta.theme.inactive
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold whitespace-nowrap">
                        {regMeta.label}
                      </span>
                      {hasRegResult && (
                        <span
                          className={`text-[10px] font-mono font-semibold ${
                            isSelected ? regMeta.theme.okActive : regMeta.theme.okInactive
                          }`}
                        >
                          OK
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        isSelected ? regMeta.theme.subActive : regMeta.theme.subInactive
                      }`}
                    >
                      {regMeta.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Active Incoterm + Régime Calculation Form & Result Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* Form Parameters tailored to active Incoterm & Régime */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Paramètres de calcul — {activeIncoterm} · {regimeConfig.label}
                </h2>
                <span className="text-xs text-slate-500">
                  Taux · Frais applicables
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

                {config.showAssurance && (
                  <div>
                    <label
                      htmlFor={`assurance-${activeIncoterm}-${activeRegime}`}
                      className="block text-xs font-medium text-slate-600 mb-1.5"
                    >
                      Taux Assurance (%)
                    </label>
                    <input
                      id={`assurance-${activeIncoterm}-${activeRegime}`}
                      type="text"
                      inputMode="decimal"
                      value={rawInputs['log-assuranceTaux'] ?? ''}
                      onChange={e => updateLogistics('assuranceTaux', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums font-semibold text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                      placeholder="0,5"
                    />
                  </div>
                )}

                {config.showAcconage && (
                  <div>
                    <label
                      htmlFor={`acconage-${activeIncoterm}-${activeRegime}`}
                      className="block text-xs font-medium text-slate-600 mb-1.5"
                    >
                      Acconage Global (MAD)
                    </label>
                    <input
                      id={`acconage-${activeIncoterm}-${activeRegime}`}
                      type="text"
                      inputMode="decimal"
                      value={rawInputs['log-royaltiesMAD'] ?? ''}
                      onChange={e => updateLogistics('royaltiesMAD', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums font-semibold text-emerald-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                      placeholder="2300"
                    />
                  </div>
                )}

                {config.showFreight && (
                  <>
                    <div>
                      <label
                        htmlFor={`fretEur-${activeIncoterm}-${activeRegime}`}
                        className="block text-xs font-medium text-slate-600 mb-1.5"
                      >
                        {isCFR ? 'Fret Global réf. (€)' : 'Fret Global (€)'}
                      </label>
                      <input
                        id={`fretEur-${activeIncoterm}-${activeRegime}`}
                        type="text"
                        inputMode="decimal"
                        value={rawInputs['log-fretGlobalEUR'] ?? ''}
                        onChange={e => updateLogistics('fretGlobalEUR', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`fretMad-${activeIncoterm}-${activeRegime}`}
                        className="block text-xs font-medium text-slate-600 mb-1.5"
                      >
                        {isCFR ? 'Fret Global réf. (MAD)' : 'Fret Global (MAD)'}
                      </label>
                      <input
                        id={`fretMad-${activeIncoterm}-${activeRegime}`}
                        type="text"
                        inputMode="decimal"
                        value={rawInputs['log-fretGlobalMAD'] ?? ''}
                        onChange={e => updateLogistics('fretGlobalMAD', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono tabular-nums text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
              </div>

              {isCFR && (
                <div className="px-5 py-3 bg-amber-50 border-t border-amber-200/80 text-xs text-amber-900 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Mode CFR : le fret est déjà inclus dans la valeur marchandise et est exclu du calcul de la Valeur en Douane.
                  </span>
                </div>
              )}

              {isCIF && (
                <div className="px-5 py-3 bg-blue-50 border-t border-blue-200/80 text-xs text-blue-900 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    Mode CIF : le fret et l’assurance (0,5% par défaut) restent modifiables. Laissez le fret à 0 s’il est déjà inclus dans la facture CIF.
                  </span>
                </div>
              )}

              {isDAT && (
                <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-200/80 text-xs text-emerald-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Mode DAT : calcul direct (Valeur € × Taux) + Assurance ({formatDecimal(logistics.assuranceTaux, 2)}%). Aucun fret ni acconage appliqué.
                  </span>
                </div>
              )}
            </section>

            {/* Articles Tables based on active Régime */}
            {has023 && (
              <ArticleTableCard
                type="023"
                title={hasAT ? 'Inventaire DUM 023 (Consommation)' : 'Inventaire Articles (DUM 023)'}
                list={articles023}
                config={config}
                totalGlobalPb={totalGlobalPb}
                logistics={logistics}
                rawInputs={rawInputs}
                savedProducts={savedProducts}
                onRemoveSavedProduct={handleRemoveSavedProduct}
                onUpdate={updateArticle}
                onRemove={removeArticle}
                onAdd={addArticle}
              />
            )}

            {hasAT && (
              <ArticleTableCard
                type="AT"
                title={
                  activeRegime === Regime.ONLY_311
                    ? 'Inventaire Articles — DUM 311 (AT seule)'
                    : `Inventaire ${atLabelShort}`
                }
                list={articlesAT}
                config={config}
                totalGlobalPb={totalGlobalPb}
                logistics={logistics}
                rawInputs={rawInputs}
                savedProducts={savedProducts}
                onRemoveSavedProduct={handleRemoveSavedProduct}
                onUpdate={updateArticle}
                onRemove={removeArticle}
                onAdd={addArticle}
              />
            )}

            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCalculate}
                className="flex-1 py-3.5 px-6 rounded-xl font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 transition-colors flex items-center justify-center gap-2.5 text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Calculer la Valeur en Douane ({activeIncoterm} · {regimeConfig.label})
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-3.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Sticky Calculation Summary Sidebar */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
            <div className="bg-[#1e3a8a] text-white rounded-xl p-6 border border-blue-950/20">
              <div className="flex items-center justify-between text-xs text-blue-200 mb-1">
                <span>Total Valeur en Douane</span>
                <span className="font-mono">{activeIncoterm} · {activeRegime}</span>
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-amber-400 mt-1 mb-5">
                {result
                  ? formatCurrency(
                      has023 && hasAT && result.regime023 && result.regimeAT
                        ? Math.round(result.regime023.valeurDouaneTotal) +
                          Math.round(result.regimeAT.valeurDouaneTotal)
                        : result.totalValeurDouane
                    )
                  : '--- DH'}
              </div>

              <div className="space-y-2.5 pt-4 border-t border-white/15 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-blue-200">Taux EUR / MAD (Global)</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-300">
                    {formatDecimal(globalTauxEurMad, 4)} DH
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-blue-200">Contre-Valeur (MAD)</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {result ? formatCurrency(result.totalValeurMAD) : '0 DH'}
                  </span>
                </div>

                {!isDAT && !isCFR && (
                  <div className="flex justify-between items-center">
                    <span className="text-blue-200">Fret Total (MAD)</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {result ? formatCurrency(result.totalFretMAD) : '0 DH'}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-blue-200">
                    Assurance ({formatDecimal(logistics.assuranceTaux, 2)}%)
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {result ? formatCurrency(result.totalAssuranceMAD) : '0 DH'}
                  </span>
                </div>

                {!isDAT && (
                  <div className="flex justify-between items-center">
                    <span className="text-blue-200">Acconage (MAD)</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {result ? formatCurrency(result.totalRoyaltiesMAD) : '0 DH'}
                    </span>
                  </div>
                )}

                <div className="pt-2.5 border-t border-white/15 space-y-2">
                  {has023 && (
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100 font-medium">DUM 023</span>
                      <span className="font-mono tabular-nums font-bold">
                        {result?.regime023 ? formatCurrency(result.regime023.valeurDouaneTotal) : '0 DH'}
                      </span>
                    </div>
                  )}

                  {hasAT && (
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-200 font-medium">{atLabelShort}</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-300">
                        {result?.regimeAT ? formatCurrency(result.regimeAT.valeurDouaneTotal) : '0 DH'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-blue-200 pt-1">
                    <span>{isCFR ? 'Poids Net Global' : 'Poids Brut Global'}</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatRounded(totalGlobalPb)} KG
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => result && generatePDFReport(result, activeRegime, activeIncoterm)}
              disabled={!result}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Rapport PDF Professionnel
            </button>

            <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed space-y-1.5">
              <div className="font-semibold text-slate-900">
                {activeIncoterm} · {regimeConfig.label}
              </div>
              <p>{config.description}</p>
              <p className="text-slate-500">
                Produits mémorisés : {savedProducts.length} (enregistrés automatiquement à chaque calcul).
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="max-w-7xl w-full mx-auto px-6 py-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>© 2026 Abdellah — All Rights Reserved</span>
        <span>Designed &amp; Developed by Abdellah</span>
      </footer>
    </div>
  );
};

export default App;