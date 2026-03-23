"use client";

import { useState, useEffect } from "react";
import {
  X, Save, Trash2, User, Calendar, BarChart3,
  Phone, MessageCircle, History, AlertTriangle,
  Home, Star, CheckCircle, Clock, Lock, Unlock
} from "lucide-react";
import clsx from "clsx";
import { pixelEvents as fbPixel } from "@/lib/facebook-pixel";
import CallPanel from "@/components/CallPanel";
import CommentsPanel from "@/components/CommentsPanel";
import { generateWhatsAppLink, getWelcomeMessage, isMobileNumber } from "@/lib/whatsapp";

interface ClientModalProps {
  clientId: number | null;
  onClose: () => void;
  onSaved: () => void;
  userRole: string;
}

interface StatusOption {
  id: number;
  type: string;
  name: string;
  color: string;
}

interface UserOption {
  id: number;
  name: string;
  role: string;
}

interface CallLogEntry {
  id: number;
  result: string;
  comment: string | null;
  createdAt: string;
  callTime: string;
}

interface FormData {
  [key: string]: unknown;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  phone1?: string;
  statusCall?: string;
  statusRDV?: string;
  leadScore?: number;
  frozen?: boolean;
}

interface FieldProps {
  label: string;
  field: string;
  type?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: number;
  form: FormData;
  updateField: (field: string, value: unknown) => void;
}

const TABS = [
  { id: "profil", label: "Profil", icon: User },
  { id: "qualification", label: "Qualif.", icon: Star },
  { id: "rdv_appels", label: "RDV", icon: Calendar },
  { id: "finance", label: "Finance", icon: BarChart3 },
];

const HEATING_OPTIONS = ["Électrique", "Gaz", "Fioul", "Pompe à chaleur", "Bois", "Autre"];

const Field = ({ label, field, type = "text", options, placeholder, span = 1, form, updateField }: FieldProps) => (
  <div className={clsx(span === 2 && "col-span-full")}>
    <label className="text-xs font-medium text-muted block mb-1">{label}</label>
    {type === "select" ? (
      <select value={(form[field] as string) || ""} onChange={(e) => updateField(field, e.target.value)}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
        <option value="">—</option>
        {options?.map((opt) => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}
      </select>
    ) : type === "textarea" ? (
      <textarea value={(form[field] as string) || ""} onChange={(e) => updateField(field, e.target.value)} placeholder={placeholder} rows={3}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y" />
    ) : type === "checkbox" ? (
      <div className="flex items-center gap-2 mt-2">
        <input type="checkbox" checked={!!form[field]} onChange={(e) => updateField(field, e.target.checked)} className="w-4 h-4 rounded border-border text-primary" />
        <span className="text-sm text-secondary">{form[field] ? "Oui" : "Non"}</span>
      </div>
    ) : (
      <input type={type} value={(form[field] as string) || ""} onChange={(e) => updateField(field, e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
    )}
  </div>
);

const HeatingMultiSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  let selected: string[] = [];
  try { selected = JSON.parse(value || "[]"); } catch { selected = value ? [value] : []; }
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt];
    onChange(JSON.stringify(next));
  };
  return (
    <div>
      <label className="text-xs font-medium text-muted block mb-1">Mode(s) de chauffage</label>
      <div className="flex flex-wrap gap-2">
        {HEATING_OPTIONS.map(opt => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={clsx("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              selected.includes(opt) ? "bg-primary text-white border-primary" : "border-border text-muted hover:border-primary hover:text-primary"
            )}>{opt}</button>
        ))}
      </div>
      {selected.length > 0 && <p className="text-xs text-primary mt-1.5">Sélectionné(s) : {selected.join(", ")}</p>}
    </div>
  );
};

function calcScore(form: FormData): { score: number; label: string; color: string } {
  let s = 0;
  const isProprio = form.isOwner === "Oui";
  if (isProprio) s += 50;
  if (form.surface && parseInt(form.surface) >= 80) s += 10;
  if (form.electricBill && parseInt(form.electricBill) >= 100) s += 15;
  if (form.householdIncome) s += 10;
  if (form.roofOrientation) s += 5;
  if (form.pool || form.electricCar) s += 5;
  s = Math.min(s, 100);
  const label = s >= 70 ? "Très haute" : s >= 50 ? "Haute" : s >= 30 ? "Moyenne" : "Basse";
  const color = s >= 70 ? "bg-green-500" : s >= 50 ? "bg-lime-500" : s >= 30 ? "bg-orange-500" : "bg-red-500";
  return { score: s, label, color };
}

const StatusBadge = ({ status, statuses, type }: { status: string; statuses: StatusOption[]; type: string }) => {
  if (!status) return null;
  const s = statuses.find(x => x.name === status && x.type === type);
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: s?.color || "#94a3b8" }}>{status}</span>;
};

export default function ClientModal({ clientId, onClose, onSaved, userRole }: ClientModalProps) {
  const [activeTab, setActiveTab] = useState("profil");
  const [loading, setLoading] = useState(!!clientId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({});
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [callHistory, setCallHistory] = useState<CallLogEntry[]>([]);
  const [showHZConfirm, setShowHZConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/statuses").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
    ]).then(([sd, ud]) => {
      setStatuses(sd.statuses || []);
      setUsers(ud.users || []);
    });
    if (clientId) {
      fetch(`/api/clients/${clientId}`).then(r => r.json()).then(d => { setForm(d.client || {}); setLoading(false); });
    } else {
      setForm({ statusCall: "NEW" }); setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (activeTab === "rdv_appels" && clientId) {
      fetch(`/api/call-log?clientId=${clientId}`).then(r => r.json()).then(d => setCallHistory(d.callLogs || []));
    }
  }, [activeTab, clientId]);

  const updateField = (field: string, value: unknown) => setForm((p: FormData) => ({ ...p, [field]: value }));

  const handleStatusCall = (v: string) => {
    if (v === "HORS ZONE") { setShowHZConfirm(true); return; }
    updateField("statusCall", v);
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const url = clientId ? `/api/clients/${clientId}` : "/api/clients";
      const method = clientId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) {
        const data = await res.json();
        if (data.pixelEvents?.length) {
          for (const evt of data.pixelEvents) {
            const cid = clientId || data.client?.id;
            if (evt === "rdv_pris") fbPixel.rdvPris(cid);
            if (evt === "signature") { const a = parseFloat(form.totalAmount); if (a > 0) fbPixel.signature(cid, a); }
            if (evt === "installation") fbPixel.installationProgrammee(cid);
            if (evt === "paiement") { const a = parseFloat(form.totalAmount); if (a > 0) fbPixel.paiement(cid, a); }
          }
        }
        onSaved();
      } else {
        let errMsg = `Erreur serveur (${res.status})`;
        try { const data = await res.json(); if (data.error) errMsg = data.error; } catch { /* ignore */ }
        setSaveError(errMsg);
        console.error("Save failed:", res.status, errMsg);
      }
    } catch (e) {
      setSaveError("Erreur réseau — vérifiez votre connexion");
      console.error("Save error:", e);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!clientId || !confirm("Supprimer ce client ? (récupérable par un admin)")) return;
    await fetch(`/api/clients/${clientId}`, { method: "DELETE" }); onSaved();
  };

  const handleToggleFrozen = async () => {
    if (!clientId) return;
    const newFrozen = !form.frozen;
    const label = newFrozen ? "Verrouiller ce client contre les modifications automatiques ?" : "Déverrouiller ce client ?";
    if (!confirm(label)) return;
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frozen: newFrozen }),
    });
    if (res.ok) { setForm((p: FormData) => ({ ...p, frozen: newFrozen })); onSaved(); }
  };

  const statut1List = statuses.filter((s) => s.type === "statut1");
  const statut2List = statuses.filter((s) => s.type === "statut2");
  const isManager = userRole === "admin" || userRole === "manager";
  const rtScore = calcScore(form);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-start sm:justify-center sm:pt-6 sm:overflow-y-auto">
        <div className="bg-card sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-4xl sm:mx-4 sm:mb-8 border border-border max-h-[95vh] sm:max-h-none flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent rounded-t-2xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm shrink-0">
                {(form.firstName?.[0] || "") + (form.lastName?.[0] || "")}
              </div>
              <div>
                <h2 className="text-base font-semibold text-secondary">
                  {clientId ? (`${form.firstName || ""} ${form.lastName || ""}`.trim() || `Client #${clientId}`) : "Nouveau client"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {form.statusCall && <StatusBadge status={form.statusCall} statuses={statuses} type="statut1" />}
                  {form.statusRDV && <StatusBadge status={form.statusRDV} statuses={statuses} type="statut2" />}
                  {form.leadScore != null && <span className="text-xs text-muted">Score: <strong>{form.leadScore}/100</strong></span>}
                  {form.frozen && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Lock size={10} />Verrouillé</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {clientId && form.mobile && (
                <a href={`tel:${form.mobile}`} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors" title="Appeler"><Phone size={16} /></a>
              )}
              {clientId && (form.mobile || form.phone1) && isMobileNumber(form.mobile || form.phone1 || "") && (
                <a href={generateWhatsAppLink(form.mobile || form.phone1, getWelcomeMessage(form.firstName || ""))} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors" title="WhatsApp"><MessageCircle size={16} /></a>
              )}
              {clientId && userRole === "admin" && (
                <button onClick={handleToggleFrozen}
                  className={clsx("p-2 rounded-lg transition-colors", form.frozen ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "text-muted hover:bg-bg")}
                  title={form.frozen ? "Déverrouiller (autoriser modifications auto)" : "Verrouiller (bloquer modifications auto)"}>
                  {form.frozen ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              )}
              {clientId && userRole === "admin" && (
                <button onClick={handleDelete} className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors" title="Supprimer"><Trash2 size={16} /></button>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg transition-colors"><X size={18} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-2 sm:px-4 overflow-x-auto scrollbar-none shrink-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              if (tab.id === "finance" && !isManager) return null;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={clsx("flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-secondary"
                  )}>
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
            {loading ? <div className="py-12 text-center text-muted">Chargement...</div> : (
              <>
                {/* ─── PROFIL ─── */}
                {activeTab === "profil" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted block mb-1">Statut Call</label>
                        <select value={form.statusCall || ""} onChange={(e) => handleStatusCall(e.target.value)}
                          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value="">—</option>
                          {statut1List.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                          <option value="HORS ZONE">🚫 HORS ZONE</option>
                        </select>
                        {form.statusCall === "HORS ZONE" && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Signal négatif FB sera envoyé</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted block mb-1">Statut RDV</label>
                        <select value={form.statusRDV || ""} onChange={(e) => updateField("statusRDV", e.target.value)}
                          className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option value="">—</option>
                          {statut2List.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <Field form={form} updateField={updateField} label="Civilité" field="civilite" type="select" options={["M.", "Mme", "M. et Mme"]} />
                      <div />
                      <Field form={form} updateField={updateField} label="Prénom" field="firstName" placeholder="Prénom" />
                      <Field form={form} updateField={updateField} label="Nom" field="lastName" placeholder="Nom" />
                      <Field form={form} updateField={updateField} label="Adresse" field="address" placeholder="Adresse" span={2} />
                      <Field form={form} updateField={updateField} label="Code postal" field="zipCode" placeholder="13000" />
                      <Field form={form} updateField={updateField} label="Ville" field="city" placeholder="Marseille" />
                      <Field form={form} updateField={updateField} label="Mobile (WhatsApp)" field="mobile" placeholder="06..." />
                      <Field form={form} updateField={updateField} label="Téléphone 1" field="phone1" placeholder="Tél" />
                      <Field form={form} updateField={updateField} label="E-mail" field="email" type="email" placeholder="email@..." />
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2"><Home size={13} /> Équipe & Source</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Commercial 1" field="commercial1Id" type="select"
                          options={users.filter((u) => u.role === "commercial").map((u) => ({ value: u.id.toString(), label: u.name }))} />
                        <Field form={form} updateField={updateField} label="Commercial 2" field="commercial2Id" type="select"
                          options={users.filter((u) => u.role === "commercial").map((u) => ({ value: u.id.toString(), label: u.name }))} />
                        <Field form={form} updateField={updateField} label="Télépos" field="teleposId" type="select"
                          options={users.filter((u) => u.role === "telepos").map((u) => ({ value: u.id.toString(), label: u.name }))} />
                        <Field form={form} updateField={updateField} label="Campagne" field="campaign" placeholder="Campagne" />
                      </div>
                    </div>

                    {form.fbLeadId && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-2">📘 Source Facebook</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-muted">Campagne:</span> <strong>{form.fbCampaignName || form.campaign || "—"}</strong></div>
                          <div><span className="text-muted">Formulaire:</span> <strong>{form.fbFormName || "—"}</strong></div>
                          <div className="col-span-full"><span className="text-muted">Lead ID:</span> <code className="bg-bg px-1 rounded">{form.fbLeadId}</code></div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3">Commentaires</h3>
                      {clientId ? (
                        <CommentsPanel
                          clientId={clientId}
                          comments={(() => { try { const p = JSON.parse(form.clientComments || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })()}
                          userRole={userRole}
                          onCommentsChange={(updated) => updateField("clientComments", JSON.stringify(updated))}
                        />
                      ) : (
                        <p className="text-sm text-muted italic">Sauvegardez le client d'abord pour ajouter des commentaires.</p>
                      )}
                      {form.observation && (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg">
                          <p className="text-xs font-semibold text-amber-700 mb-1">Ancienne note (lecture seule)</p>
                          <p className="text-sm text-secondary whitespace-pre-wrap">{form.observation}</p>
                        </div>
                      )}
                      {form.clientComments && (() => { try { JSON.parse(form.clientComments); return false; } catch { return true; } })() && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
                          <p className="text-xs font-semibold text-blue-700 mb-1">Note ancien CRM (lecture seule)</p>
                          <p className="text-sm text-secondary whitespace-pre-wrap">{form.clientComments}</p>
                        </div>
                      )}
                      <div className="mt-3">
                        <Field form={form} updateField={updateField} label="Observation commercial (visible dans le planning)" field="observationCommercial" type="textarea" placeholder="Observation après visite..." />
                      </div>
                    </div>

                  </div>
                )}

                {/* ─── QUALIFICATION ─── */}
                {activeTab === "qualification" && (
                  <div className="space-y-5">
                    {/* Score temps réel */}
                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-secondary">Score estimé (temps réel)</span>
                        <span className={clsx("px-3 py-1 rounded-full text-xs font-bold text-white", rtScore.color)}>
                          {rtScore.label} — {rtScore.score}/100
                        </span>
                      </div>
                      <div className="w-full bg-border rounded-full h-2.5">
                        <div className={clsx("h-2.5 rounded-full transition-all duration-500", rtScore.color)} style={{ width: `${rtScore.score}%` }} />
                      </div>
                      {rtScore.score >= 60 && (
                        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1"><CheckCircle size={12} /> Score ≥ 60 — Éligible pour RDV</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Proprio maison — champ unique simplifie */}
                      <div className="col-span-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-amber-700 block mb-2">Proprietaire de maison individuelle ?</label>
                        <div className="flex gap-2">
                          {[
                            { value: "oui", label: "Oui", bg: "bg-green-500 text-white", ring: "ring-green-400" },
                            { value: "non", label: "Non", bg: "bg-red-500 text-white", ring: "ring-red-400" },
                            { value: "", label: "Non renseigne", bg: "bg-gray-200 text-gray-600", ring: "ring-gray-300" },
                          ].map(opt => {
                            const isProprioMaison = form.isOwner === "Oui";
                            const isNon = form.isOwner === "Non";
                            const current = isProprioMaison ? "oui" : isNon ? "non" : "";
                            const active = current === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => {
                                  if (opt.value === "oui") {
                                    updateField("isOwner", "Oui");
                                    updateField("propertyType", "Maison individuelle");
                                  } else if (opt.value === "non") {
                                    updateField("isOwner", "Non");
                                    updateField("propertyType", form.propertyType || "");
                                  } else {
                                    updateField("isOwner", "");
                                    updateField("propertyType", "");
                                  }
                                }}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${active ? opt.bg + " ring-2 " + opt.ring + " shadow-sm" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Field form={form} updateField={updateField} label="Propriétaire depuis" field="ownerSince" placeholder="Année" />
                      <Field form={form} updateField={updateField} label="Surface habitable (m²)" field="surface" placeholder="Ex: 120" />
                      <Field form={form} updateField={updateField} label="Compteur" field="counter" type="select" options={["Monophasé", "Triphasé"]} />

                      <div className="col-span-full">
                        <HeatingMultiSelect value={form.heatingSystem || "[]"} onChange={(v) => updateField("heatingSystem", v)} />
                      </div>

                      <Field form={form} updateField={updateField} label="Facture électricité (€/mois)" field="electricBill" placeholder="Ex: 150" />
                      <Field form={form} updateField={updateField} label="Orientation toiture" field="roofOrientation" placeholder="Sud, Est-Ouest..." />
                      <Field form={form} updateField={updateField} label="Surface dispo toiture (m²)" field="roofSpace" placeholder="Ex: 20" />

                      <div>
                        <label className="text-xs font-medium text-muted block mb-1">Piscine</label>
                        <input type="checkbox" checked={!!form.pool} onChange={(e) => updateField("pool", e.target.checked)} className="w-4 h-4" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted block mb-1">Voiture électrique</label>
                        <input type="checkbox" checked={!!form.electricCar} onChange={(e) => updateField("electricCar", e.target.checked)} className="w-4 h-4" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted block mb-1">Zone ABF</label>
                        <input type="checkbox" checked={!!form.zoneABF} onChange={(e) => updateField("zoneABF", e.target.checked)} className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3">Foyer & Revenus</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Situation familiale" field="familyStatus" type="select" options={["Marié(e)", "Célibataire", "Divorcé(e)", "Veuf/Veuve", "Pacsé(e)"]} />
                        <Field form={form} updateField={updateField} label="Enfants à charge" field="children" placeholder="Nombre" />
                        <Field form={form} updateField={updateField} label="Âge Mr" field="ageMr" placeholder="Âge" />
                        <Field form={form} updateField={updateField} label="Âge Mme" field="ageMme" placeholder="Âge" />
                        <Field form={form} updateField={updateField} label="Situation Mr" field="situationMr" placeholder="CDI, Retraité..." />
                        <Field form={form} updateField={updateField} label="Situation Mme" field="situationMme" placeholder="CDI, Retraitée..." />
                        <Field form={form} updateField={updateField} label="Revenu foyer (€/mois)" field="householdIncome" placeholder="€" />
                        <Field form={form} updateField={updateField} label="Crédit en cours" field="currentCredit" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Financement souhaité" field="financing" type="select" options={["Projexio", "Sofinco", "Comptant", "Autre"]} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── APPELS & RDV ─── */}
                {activeTab === "rdv_appels" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {clientId && (
                        <button onClick={() => setShowCallPanel(true)} disabled={!form.mobile && !form.phone1}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50">
                          <Phone size={15} /> Passer un appel
                        </button>
                      )}
                      {(form.mobile || form.phone1) && isMobileNumber(form.mobile || form.phone1 || "") && (
                        <a href={generateWhatsAppLink(form.mobile || form.phone1, getWelcomeMessage(form.firstName || ""))} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1da851] transition-colors text-sm font-medium">
                          <MessageCircle size={15} /> WhatsApp
                        </a>
                      )}
                    </div>

                    {/* Historique appels */}
                    {clientId && (
                      <div>
                        <h3 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2"><History size={14} /> Historique des appels</h3>
                        {callHistory.length === 0 ? (
                          <p className="text-sm text-muted italic py-4 text-center">Aucun appel enregistré</p>
                        ) : (
                          <div className="space-y-2">
                            {callHistory.map((call) => (
                              <div key={call.id} className="border border-border rounded-lg p-3 hover:bg-bg/50">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full",
                                    call.result === "RDV_PRIS" ? "bg-green-100 text-green-700" :
                                    call.result === "NRP" ? "bg-gray-100 text-gray-600" :
                                    call.result === "A_RAPPELER" ? "bg-amber-100 text-amber-700" :
                                    call.result === "PAS_INTERESSE" ? "bg-red-100 text-red-700" :
                                    call.result === "FAUX_NUMERO" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"
                                  )}>
                                    {call.result === "RDV_PRIS" ? "✓ RDV pris" :
                                     call.result === "NRP" ? "⚪ NRP" :
                                     call.result === "A_RAPPELER" ? "📞 À rappeler" :
                                     call.result === "PAS_INTERESSE" ? "✗ Pas intéressé" :
                                     call.result === "FAUX_NUMERO" ? "⚠ Faux numéro" : "⏰ À confirmer"}
                                  </span>
                                  <span className="text-xs text-muted flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(call.createdAt).toLocaleDateString("fr-FR")} {call.callTime}
                                  </span>
                                </div>
                                {call.comment && <p className="text-sm text-secondary mt-1.5 leading-relaxed bg-bg/50 rounded p-2">{call.comment}</p>}
                                <p className="text-xs text-muted mt-1">— {call.user?.name || "N/A"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* RDV section */}
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2"><Calendar size={14} /> Rendez-vous</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Date RDV" field="rdvDate" type="date" />
                        <Field form={form} updateField={updateField} label="Heure RDV" field="rdvTime" placeholder="HH:MM" />
                        <Field form={form} updateField={updateField} label="Date VT" field="vtDate" type="date" />
                        <Field form={form} updateField={updateField} label="Heure VT" field="vtTime" placeholder="HH:MM" />
                        <Field form={form} updateField={updateField} label="Confirmé avec" field="confirmedWith" placeholder="Nom" />
                        <Field form={form} updateField={updateField} label="Type de RDV" field="typeRDV" type="select" options={["Standard", "VT", "Confirmation"]} />
                        <Field form={form} updateField={updateField} label="Infos RDV (télépro)" field="infosRDV" type="textarea" span={2} />
                        <Field form={form} updateField={updateField} label="Observation commercial (visible planning)" field="observationCommercial" type="textarea" span={2} placeholder="Retour du commercial après visite..." />
                        <Field form={form} updateField={updateField} label="Rapport commercial" field="rapportCommerciale" type="textarea" span={2} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── FINANCE ─── */}
                {activeTab === "finance" && isManager && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold text-secondary mb-3">Installation & Système</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Société" field="societe" placeholder="Société" />
                        <Field form={form} updateField={updateField} label="Banque" field="bank" type="select" options={["BNP", "Crédit Agricole", "Société Générale", "Caisse d'Épargne", "LCL", "Autre"]} />
                        <Field form={form} updateField={updateField} label="Puissance" field="power" type="select" options={["3 kWc", "6 kWc", "9 kWc", "12 kWc", "Autre"]} />
                        <Field form={form} updateField={updateField} label="Montant total pose" field="totalAmount" placeholder="€" />
                        <Field form={form} updateField={updateField} label="Date installation" field="installDate" type="date" />
                        <Field form={form} updateField={updateField} label="Produits vendus" field="products" type="textarea" placeholder="Panneaux, onduleurs, batteries..." span={2} />
                      </div>
                    </div>
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3">Primes & Aides</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Autoconsommation" field="autoConsumption" type="select" options={["Autoconsommation", "Revente totale", "Autre"]} />
                        <Field form={form} updateField={updateField} label="Récupération TVA" field="tvaRecovery" type="select" options={["Récupération de TVA", "Non applicable"]} />
                        <Field form={form} updateField={updateField} label="Ma prime Renov'" field="primeRenov" placeholder="€" />
                        <Field form={form} updateField={updateField} label="CEE" field="cee" placeholder="€" />
                      </div>
                    </div>
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold text-secondary mb-3">Marges & Commissions</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <Field form={form} updateField={updateField} label="Facture BH HT" field="invoiceHT" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Facture BH TTC" field="invoiceTTC" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Commission commercial HT" field="commissionHT" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Commission commercial TTC" field="commissionTTC" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Commission télépos final" field="commissionTelepos" type="number" placeholder="0" />
                        <Field form={form} updateField={updateField} label="Commission commercial final" field="commissionFinal" placeholder="€" />
                        <Field form={form} updateField={updateField} label="Marge BH" field="marginBH" placeholder="€" span={2} />
                        <Field form={form} updateField={updateField} label="Prix de cession" field="cessionPrice" placeholder="€" />
                        <Field form={form} updateField={updateField} label="Survente" field="oversell" placeholder="€" />
                        <Field form={form} updateField={updateField} label="CQ Yoran" field="cqYoran" />
                        <Field form={form} updateField={updateField} label="Déduction facture" field="deductionType" type="select" options={["DÉDUCTION SUR FACTURE", "Autre"]} />
                        <Field form={form} updateField={updateField} label="Frais annexes" field="annexFees" placeholder="€" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border shrink-0">
            {saveError && (
              <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-red-50 text-red-700 text-xs border-b border-red-200">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
              <div className="text-xs text-muted">{clientId ? `#${form.clientNumber ?? clientId}` : "Nouveau client"}</div>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-secondary border border-border rounded-lg hover:bg-bg transition-colors">Annuler</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm font-medium">
                  <Save size={15} />{saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HORS ZONE Confirmation */}
      {showHZConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center">
          <div className="bg-card rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={24} />
              <h3 className="text-lg font-bold text-secondary">Confirmer HORS ZONE</h3>
            </div>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              Cette action va :<br/>
              <strong>• Envoyer un signal négatif à Facebook (CAPI)</strong><br/>
              • Archiver le lead automatiquement<br/>
              • Forcer le score à 10 max<br/><br/>
              Irréversible sans intervention admin.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowHZConfirm(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-bg transition-colors">Annuler</button>
              <button onClick={() => { updateField("statusCall", "HORS ZONE"); setShowHZConfirm(false); }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Call Panel */}
      {showCallPanel && clientId && (
        <CallPanel
          clientId={clientId}
          clientName={`${form.firstName || ""} ${form.lastName || ""}`.trim()}
          phoneNumber={form.mobile || form.phone1 || ""}
          onClose={() => setShowCallPanel(false)}
          onCallCompleted={() => {
            setShowCallPanel(false);
            fetch(`/api/clients/${clientId}`).then(r => r.json()).then(d => setForm(d.client || {}));
            fetch(`/api/call-log?clientId=${clientId}`).then(r => r.json()).then(d => setCallHistory(d.callLogs || []));
          }}
        />
      )}
    </>
  );
}
