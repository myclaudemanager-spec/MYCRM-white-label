"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, X, Edit2, Trash2, Mail, MessageSquare, FileCode, Zap,
} from "lucide-react";
import clsx from "clsx";

const TEMPLATE_TYPES = [
  { value: "email_text", label: "Email texte", icon: Mail, color: "bg-blue-100 text-blue-700" },
  { value: "email_html", label: "Email HTML", icon: FileCode, color: "bg-purple-100 text-purple-700" },
  { value: "sms", label: "SMS", icon: MessageSquare, color: "bg-green-100 text-green-700" },
];

const VARIABLES = [
  "{first_name}", "{last_name}", "{phone}", "{email}", "{address}", "{city}",
  "{zip_code}", "{status}", "{rdv_date}", "{commercial}",
];

export default function ModelesView({ userRole }: { userRole: string }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, type: typeFilter });
    const res = await fetch(`/api/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async () => {
    const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
    const method = editingId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setEditingId(null);
    setForm({});
    fetchTemplates();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce modèle ?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  const openEdit = (tpl: any) => {
    setForm(tpl);
    setEditingId(tpl.id);
    setShowForm(true);
  };

  const insertVariable = (variable: string) => {
    setForm({ ...form, content: (form.content || "") + variable });
  };

  const getTypeInfo = (type: string) => {
    return TEMPLATE_TYPES.find((t) => t.value === type) || TEMPLATE_TYPES[0];
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => { setForm({ type: "email_text" }); setEditingId(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Nouveau modèle
            </button>
          )}
          <span className="text-sm text-muted">
            <span className="font-semibold text-secondary">{templates.length}</span> modèles
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-56" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="">Tous les types</option>
            {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Template cards */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center text-muted">Chargement...</div>
      ) : templates.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center text-muted">
          <Mail size={40} className="mx-auto mb-2 text-border" />
          Aucun modèle
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const typeInfo = getTypeInfo(tpl.type);
            const TypeIcon = typeInfo.icon;
            return (
              <div key={tpl.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={clsx("p-2 rounded-lg", typeInfo.color)}>
                      <TypeIcon size={16} />
                    </span>
                    <div>
                      <h4 className="font-semibold text-secondary text-sm">{tpl.name}</h4>
                      <span className="text-xs text-muted">{typeInfo.label}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(tpl)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(tpl.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                {tpl.subject && (
                  <p className="text-xs text-muted mb-2">
                    <span className="font-medium">Objet:</span> {tpl.subject}
                  </p>
                )}

                <div className="bg-bg rounded-lg p-3 text-xs text-muted max-h-24 overflow-hidden whitespace-pre-wrap">
                  {tpl.content || "—"}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    {tpl.autoSend && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-medium">
                        <Zap size={10} /> Auto
                      </span>
                    )}
                    {tpl.triggerOn && (
                      <span className="text-[10px] text-muted">
                        Déclencheur: {tpl.triggerOn}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted">
                    {new Date(tpl.updatedAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h3 className="text-lg font-semibold">{editingId ? "Modifier modèle" : "Nouveau modèle"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-bg rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Nom du modèle</label>
                  <input type="text" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Ex: Confirmation RDV" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Type</label>
                  <select value={form.type || "email_text"} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                    {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {(form.type === "email_text" || form.type === "email_html") && (
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Objet</label>
                  <input type="text" value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Objet de l'email" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Contenu</label>
                <textarea value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono resize-none" rows={10}
                  placeholder="Bonjour {first_name},&#10;&#10;Votre rendez-vous est confirmé pour le {rdv_date}..." />
              </div>

              {/* Variable insertion */}
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Variables disponibles</label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button key={v} onClick={() => insertVariable(v)}
                      className="px-2 py-1 bg-bg border border-border rounded text-xs font-mono text-primary hover:bg-primary/10 transition-colors">
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Déclencheur</label>
                  <select value={form.triggerOn || ""} onChange={(e) => setForm({ ...form, triggerOn: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                    <option value="">Aucun (manuel)</option>
                    <option value="rdv_pris">RDV pris</option>
                    <option value="rdv_confirme">RDV confirmé</option>
                    <option value="signature">Signature</option>
                    <option value="installation">Installation programmée</option>
                    <option value="paiement">Paiement reçu</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.autoSend || false}
                      onChange={(e) => setForm({ ...form, autoSend: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm">Envoi automatique</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">Annuler</button>
              <button onClick={handleSave} className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
