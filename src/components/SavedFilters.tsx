"use client";

import { useState, useEffect } from "react";
import { Star, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";

interface SavedFilter {
  id: string;
  name: string;
  filters: {
    search?: string;
    statusCall?: string;
    statusRDV?: string;
  };
  isPinned: boolean;
}

interface SavedFiltersProps {
  currentFilters: any;
  onApplyFilter: (filters: any) => void;
}

const DEFAULT_FILTERS: SavedFilter[] = [
  { id: "to-call-today", name: "À rappeler aujourd'hui", filters: { statusCall: "A RAPPELER" }, isPinned: true },
  { id: "rdv-week", name: "RDV pris", filters: { statusCall: "RDV PRIS" }, isPinned: true },
  { id: "confirmed", name: "RDV Confirmé", filters: { statusCall: "RDV CONFIRMÉ" }, isPinned: true },
  { id: "nrp", name: "NRP", filters: { statusCall: "NRP" }, isPinned: false },
  { id: "signed", name: "Signés", filters: { statusRDV: "SIGNÉ COMPLET" }, isPinned: false },
];

export default function SavedFilters({ currentFilters, onApplyFilter }: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("crm-saved-filters");
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    } else {
      setSavedFilters(DEFAULT_FILTERS);
      localStorage.setItem("crm-saved-filters", JSON.stringify(DEFAULT_FILTERS));
    }
  }, []);

  const saveToStorage = (filters: SavedFilter[]) => {
    localStorage.setItem("crm-saved-filters", JSON.stringify(filters));
    setSavedFilters(filters);
  };

  const handleSaveCurrentFilter = () => {
    if (!newFilterName.trim()) return;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: currentFilters,
      isPinned: false,
    };
    saveToStorage([...savedFilters, newFilter]);
    setShowSaveModal(false);
    setNewFilterName("");
  };

  const handleDeleteFilter = (id: string) => {
    if (confirm("Supprimer cette vue ?")) {
      saveToStorage(savedFilters.filter((f) => f.id !== id));
    }
  };

  const handleTogglePin = (id: string) => {
    saveToStorage(savedFilters.map((f) => (f.id === id ? { ...f, isPinned: !f.isPinned } : f)));
  };

  const pinnedFilters = savedFilters.filter((f) => f.isPinned);
  const unpinnedFilters = savedFilters.filter((f) => !f.isPinned);

  return (
    <div className="space-y-3">
      {pinnedFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted font-semibold">VUES RAPIDES:</span>
          {pinnedFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onApplyFilter(filter.filters)}
              className="group flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors border border-primary/20"
            >
              <Star size={12} className="fill-current" />
              {filter.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin(filter.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                title="Retirer des favoris"
              >
                <X size={12} />
              </button>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted font-semibold">AUTRES VUES:</span>
        {unpinnedFilters.map((filter) => (
          <div key={filter.id} className="group relative">
            <button
              onClick={() => onApplyFilter(filter.filters)}
              className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-bg border border-border rounded-lg text-sm font-medium transition-colors"
            >
              {filter.name}
            </button>
            <div className="absolute top-0 right-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
              <button
                onClick={() => handleTogglePin(filter.id)}
                className="p-1 bg-white border border-border rounded shadow-sm hover:bg-primary/10"
                title="Épingler"
              >
                <Star size={10} />
              </button>
              <button
                onClick={() => handleDeleteFilter(filter.id)}
                className="p-1 bg-white border border-border rounded shadow-sm hover:bg-red-50"
                title="Supprimer"
              >
                <Trash2 size={10} className="text-red-600" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-bg border border-dashed border-border rounded-lg text-sm font-medium text-muted hover:text-secondary transition-colors"
        >
          <Plus size={14} />
          Sauvegarder vue
        </button>
      </div>

      {showSaveModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowSaveModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-secondary mb-4">Sauvegarder cette vue</h3>
              <input
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="Nom de la vue (ex: Mes leads chauds)"
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCurrentFilter();
                  if (e.key === "Escape") setShowSaveModal(false);
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-bg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveCurrentFilter}
                  disabled={!newFilterName.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
