import React, { useState, useCallback, useMemo } from 'react';
import { 
  Calculator, 
  Plus, 
  Trash2, 
  FileDown, 
  TrendingUp, 
  Settings,
  AlertCircle,
  Info,
  Play,
  RotateCcw,
  LayoutDashboard,
  Globe,
  Coins,
  Truck,
  Package
} from 'lucide-react';
import { Article, Incoterm, Regime, GlobalLogistics, CalculationResult } from './types';
import { calculateCustoms, formatCurrency, formatDecimal, sanitizeNumericInput } from './utils/calculations';
import { generatePDFReport } from './utils/pdfGenerator';

interface ArticleRowProps {
  art: Article;
  type: '023' | 'AT';
  totalGlobalPb: number;
  logistics: GlobalLogistics;
  rawInputs: Record<string, string>;
  isCFR: boolean;
  updateArticle: (type: '023' | 'AT', id: number, field: keyof Article, value: string) => void;
  removeArticle: (type: '023' | 'AT', id: number) => void;
}

const ArticleRow: React.FC<ArticleRowProps> = ({ 
  art, 
  type, 
  totalGlobalPb, 
  logistics, 
  rawInputs, 
  isCFR,
  updateArticle, 
  removeArticle 
}) => {
  const acconage = totalGlobalPb > 0 ? (logistics.royaltiesMAD / totalGlobalPb) * (art.poidsBrut || 0) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-2xl items-end border border-slate-100 group hover:border-blue-200 transition-all">
      <div className="md:col-span-3">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Désignation</label>
        <input 
          type="text" 
          value={art.designation} 
          onChange={e => updateArticle(type, art.id, 'designation', e.target.value)} 
          className="w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" 
          placeholder="Articles..." 
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Valeur (€)</label>
        <input 
          type="text" 
          value={rawInputs[`${type}-${art.id}-valeurEUR`] ?? art.valeurEUR.toString()} 
          onChange={e => updateArticle(type, art.id, 'valeurEUR', e.target.value)} 
          className="w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" 
          placeholder="0" 
        />
      </div>
      <div className="md:col-span-1">
        <label className="text-[11px] font-black text-blue-400 uppercase tracking-widest ml-1">Fret (€)</label>
        <input 
          type="text" 
          value={rawInputs[`${type}-${art.id}-fretEUR`] ?? (art.fretEUR || 0).toString()} 
          onChange={e => updateArticle(type, art.id, 'fretEUR', e.target.value)} 
          className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" 
          placeholder="0" 
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
          {isCFR ? 'Net (KG)' : 'Brut (KG)'}
        </label>
        <input 
          type="text" 
          value={rawInputs[`${type}-${art.id}-poidsBrut`] ?? art.poidsBrut.toString()} 
          onChange={e => updateArticle(type, art.id, 'poidsBrut', e.target.value)} 
          className="w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" 
          placeholder="0" 
        />
      </div>
      <div className="md:col-span-3">
        <label className="text-[11px] font-black text-emerald-600 uppercase tracking-widest ml-1">Acconage (DH)</label>
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-2 text-[10px] font-black text-emerald-700 truncate select-none">
          {formatDecimal(acconage)}
        </div>
      </div>
      <div className="md:col-span-1 flex justify-center pb-1">
        <button 
          onClick={() => removeArticle(type, art.id)} 
          className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
          title="Supprimer l'article"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface InventoryCardProps {
  type: '023' | 'AT';
  title: string;
  list: Article[];
  icon: any;
  isMixedMode: boolean;
  isCFR: boolean;
  totalGlobalPb: number;
  logistics: GlobalLogistics;
  rawInputs: Record<string, string>;
  updateArticle: (type: '023' | 'AT', id: number, field: keyof Article, value: string) => void;
  removeArticle: (type: '023' | 'AT', id: number) => void;
  addArticle: (type: '023' | 'AT') => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({ 
  type, title, list, icon: Icon, isMixedMode, isCFR, totalGlobalPb, logistics, rawInputs, updateArticle, removeArticle, addArticle 
}) => (
  <div className={`bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden ${isMixedMode && type === 'AT' ? 'border-emerald-200' : ''}`}>
    <div className={`px-6 py-4 flex items-center justify-between border-b ${type === '023' ? 'bg-blue-50/50' : 'bg-emerald-50/50'}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${type === '023' ? 'text-blue-600' : 'text-emerald-600'}`} />
        <h2 className={`text-sm font-black uppercase tracking-tight ${type === '023' ? 'text-blue-900' : 'text-emerald-900'}`}>{title}</h2>
      </div>
      <button 
        onClick={() => addArticle(type)} 
        className={`text-[10px] font-black flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white shadow-sm transition-transform active:scale-95 ${type === '023' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
      >
        <Plus className="w-4 h-4" /> AJOUTER ARTICLE
      </button>
    </div>
    <div className="p-4 space-y-2">
      {list.map(art => (
        <ArticleRow 
          key={art.id} 
          art={art} 
          type={type} 
          totalGlobalPb={totalGlobalPb}
          logistics={logistics}
          rawInputs={rawInputs}
          isCFR={isCFR}
          updateArticle={updateArticle}
          removeArticle={removeArticle}
        />
      ))}
    </div>
  </div>
);

const App: React.FC = () => {
  const DEFAULT_EUR_MAD = 10.85;
  const INITIAL_ARTICLE = (id: number): Article => ({ id, designation: '', poidsBrut: 0, poidsNet: 0, valeurEUR: 0, fretEUR: 0 });

  const [regime, setRegime] = useState<Regime>(Regime.ONLY_023);
  const [incoterm, setIncoterm] = useState<Incoterm>(Incoterm.FOB);
  const [logistics, setLogistics] = useState<GlobalLogistics>({
    fretGlobalEUR: 0, 
    fretGlobalMAD: 0, 
    assuranceTaux: 0.5, 
    royaltiesMAD: 2300, 
    tauxEurMad: DEFAULT_EUR_MAD
  });

  const [articles023, setArticles023] = useState<Article[]>([INITIAL_ARTICLE(1)]);
  const [articlesAT, setArticlesAT] = useState<Article[]>([INITIAL_ARTICLE(1)]);

  const [rawInputs, setRawInputs] = useState<Record<string, string>>({
    'log-tauxEurMad': DEFAULT_EUR_MAD.toString().replace('.', ','),
    'log-royaltiesMAD': '2300',
    'log-assuranceTaux': '0,5',
    'log-fretGlobalEUR': '0',
    'log-fretGlobalMAD': '0'
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const isMixedMode = regime !== Regime.ONLY_023;
  const isCFR = incoterm === Incoterm.CFR;

  const totalGlobalPb = useMemo(() => {
    const pb023 = articles023.reduce((sum, a) => sum + (a.poidsBrut || 0), 0);
    const pbAT = isMixedMode ? articlesAT.reduce((sum, a) => sum + (a.poidsBrut || 0), 0) : 0;
    return pb023 + pbAT;
  }, [articles023, articlesAT, isMixedMode]);

  const handleCalculate = useCallback(() => {
    setIsCalculating(true);
    setTimeout(() => {
      const res = calculateCustoms(articles023, regime, incoterm, logistics, articlesAT);
      setResult(res);
      setIsCalculating(false);
    }, 400);
  }, [articles023, articlesAT, regime, incoterm, logistics]);

  const handleReset = useCallback(() => {
    setArticles023([INITIAL_ARTICLE(1)]);
    setArticlesAT([INITIAL_ARTICLE(1)]);
    setLogistics({ 
      fretGlobalEUR: 0, 
      fretGlobalMAD: 0, 
      assuranceTaux: 0.5, 
      royaltiesMAD: 2300, 
      tauxEurMad: DEFAULT_EUR_MAD 
    });
    setRawInputs({ 
      'log-tauxEurMad': DEFAULT_EUR_MAD.toString().replace('.', ','), 
      'log-royaltiesMAD': '2300',
      'log-assuranceTaux': '0,5',
      'log-fretGlobalEUR': '0',
      'log-fretGlobalMAD': '0'
    });
    setResult(null);
  }, []);

  const addArticle = (type: '023' | 'AT') => {
    const list = type === '023' ? articles023 : articlesAT;
    const setter = type === '023' ? setArticles023 : setArticlesAT;
    const nextId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
    setter([...list, INITIAL_ARTICLE(nextId)]);
  };

  const removeArticle = (type: '023' | 'AT', id: number) => {
    const list = type === '023' ? articles023 : articlesAT;
    const setter = type === '023' ? setArticles023 : setArticlesAT;
    if (list.length > 1) setter(list.filter(a => a.id !== id));
  };

  const updateArticle = (type: '023' | 'AT', id: number, field: keyof Article, value: string) => {
    const list = type === '023' ? articles023 : articlesAT;
    const setter = type === '023' ? setArticles023 : setArticlesAT;
    const inputKey = `${type}-${id}-${field}`;

    setRawInputs(prev => ({ ...prev, [inputKey]: value }));

    if (field === 'designation') {
      setter(list.map(a => a.id === id ? { ...a, [field]: value } : a));
      return;
    }

    const num = sanitizeNumericInput(value);
    setter(list.map(a => a.id === id ? { ...a, [field]: num } : a));
  };

  const updateLogistics = (field: keyof GlobalLogistics, rawValue: string) => {
    const inputKey = `log-${field}`;
    const val = sanitizeNumericInput(rawValue);
    
    setRawInputs(prev => {
      const newInputs = { ...prev, [inputKey]: rawValue };
      
      setLogistics(current => {
        const updated = { ...current, [field]: val };
        
        if (field === 'fretGlobalEUR') {
          const madVal = Number((val * (current.tauxEurMad || 0)).toFixed(2));
          updated.fretGlobalMAD = madVal;
          newInputs['log-fretGlobalMAD'] = madVal.toString().replace('.', ',');
        } else if (field === 'fretGlobalMAD') {
          const eurVal = current.tauxEurMad > 0 ? Number((val / current.tauxEurMad).toFixed(2)) : 0;
          updated.fretGlobalEUR = eurVal;
          newInputs['log-fretGlobalEUR'] = eurVal.toString().replace('.', ',');
        } else if (field === 'tauxEurMad') {
          const madVal = Number(((current.fretGlobalEUR || 0) * val).toFixed(2));
          updated.fretGlobalMAD = madVal;
          newInputs['log-fretGlobalMAD'] = madVal.toString().replace('.', ',');
        }
        
        return updated;
      });
      
      return newInputs;
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-24 lg:pb-0">
      <header className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg shadow-inner"><Calculator className="w-8 h-8 text-white" /></div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight leading-none">Douane Maroc Calculator</h1>
              <p className="text-[10px] text-blue-200 mt-1 font-bold tracking-widest opacity-80 uppercase">Designed & Developed by Abdellah</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="text-sm font-black uppercase text-slate-900 tracking-widest">Paramètres Généraux</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Incoterm
                  </label>
                  <select value={incoterm} onChange={e => setIncoterm(e.target.value as Incoterm)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-600 outline-none appearance-none cursor-pointer">
                    {Object.values(Incoterm).map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <LayoutDashboard className="w-3 h-3" /> Régime Douanier
                  </label>
                  <select value={regime} onChange={e => setRegime(e.target.value as Regime)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold focus:border-blue-600 outline-none font-mono cursor-pointer">
                    <option value={Regime.ONLY_023}>DUM 023 (Unique)</option>
                    <option value={Regime.MIXED_312}>023 + 312 (AT)</option>
                    <option value={Regime.MIXED_311}>023 + 311 (AT)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Coins className="w-3 h-3" /> Taux EUR/MAD
                  </label>
                  <input type="text" value={rawInputs['log-tauxEurMad']} onChange={e => updateLogistics('tauxEurMad', e.target.value)} className="w-full bg-amber-50/30 border-2 border-amber-100 rounded-2xl px-4 py-3 font-bold text-amber-700 outline-none focus:border-amber-500" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Truck className="w-3 h-3 text-blue-500" /> Fret Global (€)
                  </label>
                  <input type="text" value={rawInputs['log-fretGlobalEUR']} onChange={e => updateLogistics('fretGlobalEUR', e.target.value)} className="w-full bg-blue-50/20 border-2 border-blue-100 rounded-2xl px-4 py-3 font-bold text-blue-800 outline-none focus:border-blue-500" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Truck className="w-3 h-3 text-blue-600" /> Fret Global (MAD)
                  </label>
                  <input type="text" value={rawInputs['log-fretGlobalMAD']} onChange={e => updateLogistics('fretGlobalMAD', e.target.value)} className="w-full bg-blue-50/40 border-2 border-blue-200 rounded-2xl px-4 py-3 font-bold text-blue-900 outline-none focus:border-blue-600" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Package className="w-3 h-3" /> Acconage Global (MAD)
                  </label>
                  <input type="text" value={rawInputs['log-royaltiesMAD']} onChange={e => updateLogistics('royaltiesMAD', e.target.value)} className="w-full bg-emerald-50/30 border-2 border-emerald-100 rounded-2xl px-4 py-3 font-bold text-emerald-900 outline-none focus:border-emerald-500" placeholder="0" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isCFR && (
              <div className="bg-amber-500 text-white text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-md flex items-center gap-2 animate-pulse uppercase tracking-[0.1em] w-fit mx-auto">
                <Info className="w-4 h-4" /> Mode CFR Actif : Le fret est considéré inclus dans la valeur et est exclu du calcul VD.
              </div>
            )}
            
            <InventoryCard 
              type="023" 
              title={isMixedMode ? (isCFR ? "Inventaire DUM 023" : "Inventaire DUM 023 (Consommation)") : "Inventaire Articles (DUM 023)"} 
              list={articles023} 
              icon={LayoutDashboard} 
              isMixedMode={isMixedMode}
              isCFR={isCFR}
              totalGlobalPb={totalGlobalPb}
              logistics={logistics}
              rawInputs={rawInputs}
              updateArticle={updateArticle}
              removeArticle={removeArticle}
              addArticle={addArticle}
            />

            {isMixedMode && (
              <InventoryCard 
                type="AT" 
                title={`Inventaire DUM AT (${regime === Regime.MIXED_311 ? '311' : '312'})`} 
                list={articlesAT} 
                icon={TrendingUp} 
                isMixedMode={isMixedMode}
                isCFR={isCFR}
                totalGlobalPb={totalGlobalPb}
                logistics={logistics}
                rawInputs={rawInputs}
                updateArticle={updateArticle}
                removeArticle={removeArticle}
                addArticle={addArticle}
              />
            )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleCalculate} 
              disabled={isCalculating} 
              className={`flex-1 py-5 rounded-[2rem] font-black text-white flex items-center justify-center gap-4 transition-all shadow-xl text-xl uppercase tracking-widest ${isCalculating ? 'bg-slate-400' : 'bg-[#1e3a8a] hover:bg-blue-800 active:scale-[0.98]'}`}
            >
              {isCalculating ? <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" /> : <Play className="w-6 h-6 fill-white" />}
              Calculer la Valeur en Douane
            </button>
            <button 
              onClick={handleReset} 
              className="px-8 py-5 rounded-[2rem] font-black text-rose-600 bg-rose-50 border-2 border-rose-100 hover:bg-rose-100 transition-all flex items-center justify-center gap-3 uppercase tracking-widest shadow-lg active:scale-95"
              title="Réinitialiser à zéro"
            >
              <RotateCcw className="w-6 h-6" /> RESET
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-28 space-y-6">
            <div className={`bg-gradient-to-br from-[#1e3a8a] to-blue-900 rounded-[2.5rem] p-8 text-white shadow-2xl border-4 border-amber-500/20 transition-all ${!result ? 'opacity-50 grayscale' : 'opacity-100'}`}>
              <span className="text-blue-300 text-[11px] font-black uppercase tracking-widest block mb-1">RÉSULTAT VD TOTAL</span>
              <div className="text-4xl font-black text-amber-400 mb-6 drop-shadow-md">
                {result ? formatCurrency(result.totalValeurDouane) : "---,--- DH"}
              </div>
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="opacity-60 font-bold uppercase">DUM 023</span>
                  <span className="font-black text-blue-100">{result ? formatCurrency(result.regime023.valeurDouaneTotal) : "0 DH"}</span>
                </div>
                {result?.regimeSecondary && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="opacity-60 font-bold uppercase">DUM AT</span>
                    <span className="font-black text-emerald-300">{formatCurrency(result.regimeSecondary.valeurDouaneTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-white/10 opacity-60">
                  <span className="font-black uppercase tracking-tighter">POIDS BRUT GLOBAL</span>
                  <span className="font-black">{totalGlobalPb} KG</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => result && generatePDFReport(result, regime, incoterm)} 
              disabled={!result}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black transition-all uppercase text-sm shadow-lg ${!result ? 'bg-slate-300 text-slate-500 opacity-50 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95'}`}
            >
              <FileDown className="w-6 h-6" /> Rapport PDF Professionnel
            </button>

            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex gap-4">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-800 font-medium leading-relaxed">
                {isCFR 
                  ? "Note CFR: Le fret n'est pas rajouté à la VD (déjà inclus). Entrez le fret par article s'il diffère du pro-rata standard."
                  : "Vous pouvez spécifier le fret par article. Si laissé à 0, le système utilise automatiquement le fret global pro-raté par poids brut."}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">© 2026 Abdellah – All Rights Reserved</p>
      </footer>
    </div>
  );
};

export default App;