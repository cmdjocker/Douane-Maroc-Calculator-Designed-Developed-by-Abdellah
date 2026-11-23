import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface DesignationComboboxProps {
  value: string;
  savedProducts: string[];
  onChange: (value: string) => void;
  onRemoveSavedProduct: (product: string) => void;
  placeholder?: string;
}

export const DesignationCombobox: React.FC<DesignationComboboxProps> = ({
  value,
  savedProducts,
  onChange,
  onRemoveSavedProduct,
  placeholder = 'Sélectionner ou saisir un produit...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAll(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = value.trim().toLowerCase();
  const filteredProducts =
    showAll || !normalizedQuery
      ? savedProducts
      : savedProducts.filter(p => p.toLowerCase().includes(normalizedQuery));

  const handleSelect = (product: string) => {
    onChange(product);
    setIsOpen(false);
    setShowAll(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onFocus={() => {
            setShowAll(false);
            setIsOpen(true);
          }}
          onChange={e => {
            setShowAll(false);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setShowAll(false);
            }
          }}
          className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10"
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setShowAll(true);
            setIsOpen(prev => !prev);
          }}
          className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
          aria-label="Afficher les produits enregistrés"
          title="Choisir parmi les produits déjà calculés"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Produits calculés précédemment</span>
            <span className="font-mono tabular-nums">{filteredProducts.length}</span>
          </div>

          {filteredProducts.length > 0 ? (
            <ul className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
              {filteredProducts.map(product => (
                <li
                  key={product}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-blue-50/70 cursor-pointer transition-colors group"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleSelect(product);
                  }}
                >
                  <span className="truncate">{product}</span>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveSavedProduct(product);
                    }}
                    className="p-0.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Retirer de l'historique"
                    aria-label={`Retirer ${product}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-xs text-slate-500">
              {savedProducts.length === 0
                ? 'Aucun produit enregistré pour le moment. Saisissez un nom et lancez un calcul pour le mémoriser.'
                : 'Aucune correspondance dans l’historique — ce nouveau produit sera enregistré au calcul.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
