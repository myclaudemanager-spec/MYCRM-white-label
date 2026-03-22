"use client";

import { X } from "lucide-react";

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { category: "Navigation", shortcuts: [
    { keys: ["Ctrl", "1"], description: "Aller au Dashboard" },
    { keys: ["Ctrl", "2"], description: "Aller aux Clients" },
    { keys: ["Ctrl", "3"], description: "Aller au Planning" },
    { keys: ["Ctrl", "4"], description: "Aller aux Factures" },
    { keys: ["Ctrl", "5"], description: "Aller aux Actions" },
  ]},
  { category: "Actions", shortcuts: [
    { keys: ["Ctrl", "N"], description: "Nouveau client" },
    { keys: ["/"], description: "Focus recherche" },
    { keys: ["Échap"], description: "Fermer modal/panel" },
  ]},
];

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-secondary">Raccourcis clavier</h2>
              <p className="text-sm text-muted mt-1">Gagnez du temps avec ces raccourcis</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {SHORTCUTS.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">{section.category}</h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-bg transition-colors">
                      <span className="text-sm text-secondary">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j}>
                            <kbd className="px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-mono font-semibold text-secondary shadow-sm">{key}</kbd>
                            {j < shortcut.keys.length - 1 && <span className="mx-1 text-muted">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border bg-bg/50 text-center">
            <p className="text-xs text-muted">
              Appuyez sur <kbd className="px-2 py-1 bg-card border border-border rounded text-xs font-mono">?</kbd> pour afficher cette aide
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
