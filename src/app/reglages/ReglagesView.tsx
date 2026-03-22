"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Tag, Users, Megaphone, Calendar, Settings, Pencil, Check, Zap,
  ArrowRight, Shield, Eye, Play, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

const SETTINGS_TABS = [
  { id: "statuts", label: "Cycle Commercial", short: "Cycle", icon: Tag },
  { id: "campagnes", label: "Organisation", short: "Orga.", icon: Megaphone },
  { id: "parametres", label: "Paramètres", short: "Params", icon: Settings },
  { id: "automatisations", label: "Automatisations", short: "Auto", icon: Zap },
];

export default function ReglagesView({ userRole }: { userRole: string }) {
  const [activeTab, setActiveTab] = useState("statuts");
  const isAdmin = userRole === "admin";

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-xl border border-border p-1 overflow-x-auto">
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2.5 rounded-lg text-[11px] sm:text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-secondary hover:bg-bg"
              )}
            >
              <Icon size={13} />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "statuts" && <StatutsTab isAdmin={isAdmin} />}
      {activeTab === "campagnes" && <CampagnesTab isAdmin={isAdmin} />}
      {activeTab === "parametres" && <ParametresTab isAdmin={isAdmin} />}
      {activeTab === "automatisations" && <AutomatisationsTab isAdmin={isAdmin} />}
    </div>
  );
}

// ============ STATUTS TAB ============
function StatutsTab({ isAdmin }: { isAdmin: boolean }) {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newStatus, setNewStatus] = useState({ name: "", type: "statut1", color: "#3b82f6" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", color: "" });

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/statuses");
    const data = await res.json();
    setStatuses(data.statuses || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const handleAdd = async () => {
    if (!newStatus.name.trim()) return;
    await fetch("/api/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStatus),
    });
    setNewStatus({ name: "", type: "statut1", color: "#3b82f6" });
    setShowAdd(false);
    fetchStatuses();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce statut ?")) return;
    await fetch(`/api/statuses/${id}`, { method: "DELETE" });
    fetchStatuses();
  };

  const startEdit = (s: any) => {
    setEditId(s.id);
    setEditData({ name: s.name, color: s.color });
  };

  const handleEdit = async () => {
    if (!editId || !editData.name.trim()) return;
    await fetch(`/api/statuses/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setEditId(null);
    fetchStatuses();
  };

  const statut1 = statuses.filter((s) => s.type === "statut1");
  const statut2 = statuses.filter((s) => s.type === "statut2");

  const renderStatusList = (list: any[], title: string) => (
    <div className="bg-card rounded-xl border border-border p-5">
      <h4 className="text-sm font-semibold mb-3">{title} — {list.length} statuts</h4>
      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm group">
              {editId === s.id ? (
                <>
                  <input
                    type="color"
                    value={editData.color}
                    onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-24 px-1 py-0.5 bg-bg border border-border rounded text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    autoFocus
                  />
                  <button onClick={handleEdit} className="text-success hover:bg-success/10 rounded p-0.5" title="Enregistrer">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditId(null)} className="text-muted hover:bg-bg rounded p-0.5" title="Annuler">
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="font-medium">{s.name}</span>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(s)} className="text-primary hover:bg-primary/10 rounded p-0.5" title="Modifier">
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-danger hover:bg-danger/10 rounded p-0.5" title="Supprimer">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gestion des statuts</h3>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">
            <Plus size={16} /> Ajouter
          </button>
        )}
      </div>

      {renderStatusList(statut1, "📞 Statuts d'Appels (Téléprospection)")}
      {renderStatusList(statut2, "✍️ Statuts RDV / Commercial")}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold">Nouveau statut</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-bg rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Nom</label>
                <input type="text" value={newStatus.name} onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Nom du statut" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Type</label>
                <select value={newStatus.type} onChange={(e) => setNewStatus({ ...newStatus, type: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                  <option value="statut1">📞 Statut d'Appel (Téléprospection)</option>
                  <option value="statut2">✍️ Statut RDV / Commercial</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Couleur</label>
                <input type="color" value={newStatus.color} onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  className="w-12 h-8 rounded border border-border cursor-pointer" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-bg">Annuler</button>
              <button onClick={handleAdd} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ CAMPAGNES TAB ============
function CampagnesTab({ isAdmin }: { isAdmin: boolean }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    fetchCampaigns();
  };

  const toggleActive = async (c: any) => {
    await fetch(`/api/campaigns/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, active: !c.active }),
    });
    fetchCampaigns();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    fetchCampaigns();
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    await fetch(`/api/campaigns/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditId(null);
    fetchCampaigns();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <h3 className="text-lg font-semibold">Campagnes</h3>

      {isAdmin && (
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la campagne" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <button onClick={handleAdd} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-muted">Aucune campagne</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-bg rounded-lg group">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={clsx("w-2 h-2 rounded-full shrink-0", c.active ? "bg-green-500" : "bg-gray-300")} />
                {editId === c.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-card border border-border rounded text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                      autoFocus
                    />
                    <button onClick={handleEdit} className="text-success p-1"><Check size={14} /></button>
                    <button onClick={() => setEditId(null)} className="text-muted p-1"><X size={14} /></button>
                  </div>
                ) : (
                  <span className="text-sm font-medium truncate">{c.name}</span>
                )}
              </div>
              {isAdmin && editId !== c.id && (
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(c)}
                    className={clsx("px-2 py-1 rounded text-xs font-medium", c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                    {c.active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => { setEditId(c.id); setEditName(c.name); }}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ EQUIPES TAB ============
function EquipesTab({ isAdmin }: { isAdmin: boolean }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.teams || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    fetchTeams();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette équipe ?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    fetchTeams();
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    await fetch(`/api/teams/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditId(null);
    fetchTeams();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <h3 className="text-lg font-semibold">Équipes</h3>

      {isAdmin && (
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de l'équipe" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <button onClick={handleAdd} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted">Aucune équipe</p>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-bg rounded-lg group">
              {editId === t.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 bg-card border border-border rounded text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    autoFocus
                  />
                  <button onClick={handleEdit} className="text-success p-1"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="text-muted p-1"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">{t.name}</span>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditId(t.id); setEditName(t.name); }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ RDV TYPES TAB ============
function RDVTypesTab({ isAdmin }: { isAdmin: boolean }) {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState({ name: "", color: "#3b82f6" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", color: "" });

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/rdv-types");
    const data = await res.json();
    setTypes(data.rdvTypes || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleAdd = async () => {
    if (!newType.name.trim()) return;
    await fetch("/api/rdv-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newType),
    });
    setNewType({ name: "", color: "#3b82f6" });
    fetchTypes();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce type de RDV ?")) return;
    await fetch(`/api/rdv-types/${id}`, { method: "DELETE" });
    fetchTypes();
  };

  const handleEdit = async () => {
    if (!editId || !editData.name.trim()) return;
    await fetch(`/api/rdv-types/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setEditId(null);
    fetchTypes();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <h3 className="text-lg font-semibold">Types de RDV</h3>

      {isAdmin && (
        <div className="flex gap-2">
          <input type="text" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })}
            placeholder="Nom du type" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          <input type="color" value={newType.color} onChange={(e) => setNewType({ ...newType, color: e.target.value })}
            className="w-10 h-10 rounded border border-border cursor-pointer" />
          <button onClick={handleAdd} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
            <Plus size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Chargement...</p>
      ) : types.length === 0 ? (
        <p className="text-sm text-muted">Aucun type de RDV</p>
      ) : (
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-bg rounded-lg group">
              {editId === t.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={editData.color}
                    onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                    className="w-8 h-8 rounded border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="flex-1 px-2 py-1 bg-card border border-border rounded text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    autoFocus
                  />
                  <button onClick={handleEdit} className="text-success p-1"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="text-muted p-1"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditId(t.id); setEditData({ name: t.name, color: t.color }); }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ PARAMETRES TAB ============
function ParametresTab({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const s of data.settings || []) map[s.key] = s.value;
        setSettings(map);
        setLoading(false);
      });
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const SETTING_FIELDS = [
    { key: "company_name", label: "Nom de la société", placeholder: "Energie Solaire France" },
    { key: "company_email", label: "Email société", placeholder: "contact@energiesolairefrance.fr" },
    { key: "company_phone", label: "Téléphone société", placeholder: "01 23 45 67 89" },
    { key: "company_address", label: "Adresse société", placeholder: "123 rue..." },
    { key: "fb_pixel_id", label: "Facebook Pixel ID", placeholder: "123456789012345" },
    { key: "default_rdv_duration", label: "Durée RDV par défaut", placeholder: "60 min" },
  ];

  if (loading) return <p className="text-sm text-muted p-5">Chargement...</p>;

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Paramètres généraux</h3>
        {saved && <span className="text-xs text-green-600 font-medium animate-pulse">Enregistré ✓</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SETTING_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-muted block mb-1">{f.label}</label>
            <input
              type="text"
              value={settings[f.key] || ""}
              onChange={(e) => updateSetting(f.key, e.target.value)}
              onBlur={() => isAdmin && saveSetting(f.key, settings[f.key] || "")}
              placeholder={f.placeholder}
              disabled={!isAdmin}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted">Seuls les administrateurs peuvent modifier les paramètres.</p>
      )}
    </div>
  );
}

// ============ AUTOMATISATIONS TAB ============

interface AutomationToggle {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
}

function AutomatisationsTab({ isAdmin }: { isAdmin: boolean }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const s of data.settings || []) map[s.key] = s.value;
        setSettings(map);
        setLoading(false);
      });
  }, []);

  const toggleSetting = async (key: string) => {
    if (!isAdmin) return;
    const current = settings[key] === "true";
    const newValue = current ? "false" : "true";

    setSaving(key);
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: newValue }),
    });

    setSaving(null);
  };

  const activeAutomations: AutomationToggle[] = [
    {
      key: "auto_assign_leads",
      label: "📋 Assignation automatique des leads",
      description: "Chaque nouveau lead est assigné automatiquement au télépros le moins chargé. Si désactivé, les leads arrivent non assignés (à répartir manuellement).",
      enabled: settings["auto_assign_leads"] === "true",
    },
    {
      key: "auto_wa_welcome",
      label: "WhatsApp bienvenue lead",
      description: "Envoie automatiquement un message WhatsApp au nouveau lead propriétaire.",
      enabled: settings["auto_wa_welcome"] === "true",
    },
    {
      key: "auto_tg_quality_alert",
      label: "Alerte qualité leads (Telegram)",
      description: "David alerte sur Telegram si le ratio propriétaire tombe sous 30%.",
      enabled: settings["auto_tg_quality_alert"] === "true",
    },
    {
      key: "auto_daily_report",
      label: "Rapport quotidien 18h (Telegram)",
      description: "Rapport journalier : leads, dépenses FB, signaux CAPI.",
      enabled: settings["auto_daily_report"] === "true",
    },
  ];

  const futureAutomations = [
    { label: "Confirmation RDV WhatsApp", description: "Envoi automatique de confirmation de RDV par WhatsApp." },
    { label: "Suivi post-RDV", description: "Message de suivi automatique après un rendez-vous." },
    { label: "Liste d'appels prioritaire", description: "Génération automatique de la liste d'appels du jour." },
  ];

  if (loading) return <p className="text-sm text-muted p-5">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* Active automations */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary" />
          <h3 className="text-lg font-semibold">Automatisations David</h3>
        </div>
        <p className="text-xs text-muted">
          David (IA) exécute ces tâches automatiquement selon les toggles ci-dessous.
        </p>

        <div className="space-y-3">
          {activeAutomations.map((auto) => (
            <div
              key={auto.key}
              className="flex items-center justify-between px-4 py-3 bg-bg rounded-lg"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium">{auto.label}</p>
                <p className="text-xs text-muted mt-0.5">{auto.description}</p>
              </div>
              <button
                onClick={() => toggleSetting(auto.key)}
                disabled={!isAdmin || saving === auto.key}
                className={clsx(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                  auto.enabled ? "bg-primary" : "bg-gray-300"
                )}
              >
                <span
                  className={clsx(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200",
                    auto.enabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          ))}
        </div>

        {!isAdmin && (
          <p className="text-xs text-muted">Seuls les administrateurs peuvent modifier les automatisations.</p>
        )}
      </div>

      {/* Assignation manuelle des leads non assignés */}
      <AssignationManuellePanel isAdmin={isAdmin} autoAssignEnabled={settings["auto_assign_leads"] === "true"} />

      {/* Workflow Relance NRP — à approuver */}
      <RelanceWorkflowPanel isAdmin={isAdmin} settings={settings} onToggle={toggleSetting} saving={saving} />

      {/* Future automations (greyed out) */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4 opacity-60">
        <h4 className="text-sm font-semibold text-muted">Automatisations futures (bientôt disponibles)</h4>
        <div className="space-y-3">
          {futureAutomations.map((auto, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 bg-bg rounded-lg">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium text-muted">{auto.label}</p>
                <p className="text-xs text-muted mt-0.5">{auto.description}</p>
              </div>
              <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-gray-200 cursor-not-allowed">
                <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow translate-x-0 mt-0.5 ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Workflow Relance NRP ────────────────────────────────────────────────────
function RelanceWorkflowPanel({ isAdmin, settings, onToggle, saving }: {
  isAdmin: boolean;
  settings: Record<string, string>;
  onToggle: (key: string) => void;
  saving: string | null;
}) {
  const enabled = settings["auto_relance_nrp"] === "true";
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreviewTable, setShowPreviewTable] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    const r = await fetch("/api/automations/relance-preview");
    const d = await r.json();
    setPreview(d);
    setLoadingPreview(false);
  };

  useEffect(() => { loadPreview(); }, []);

  const FlowStep = ({ label, color, sub }: { label: string; color: string; sub?: string }) => (
    <div className={clsx("px-3 py-2 rounded-lg border-2 text-center min-w-[90px]", color)}>
      <p className="text-xs font-bold">{label}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );

  const Arrow = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center mx-1">
      <span className="text-[10px] text-muted font-medium">{label}</span>
      <ArrowRight size={16} className="text-muted" />
    </div>
  );

  return (
    <div className={clsx(
      "bg-card rounded-xl border-2 p-5 space-y-5 transition-colors",
      enabled ? "border-primary/40" : "border-amber-300/60"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center", enabled ? "bg-primary/10" : "bg-amber-100")}>
            <RefreshCw size={16} className={enabled ? "text-primary" : "text-amber-600"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Relance automatique NRP</h3>
              <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full",
                enabled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              )}>{enabled ? "ACTIF" : "EN ATTENTE D'APPROBATION"}</span>
            </div>
            <p className="text-xs text-muted">Remet automatiquement en À RAPPELER les leads NRP / Faux numéro / Pas intéressé</p>
          </div>
        </div>
        <button
          onClick={() => onToggle("auto_relance_nrp")}
          disabled={!isAdmin || saving === "auto_relance_nrp"}
          title={isAdmin ? (enabled ? "Désactiver" : "Activer") : "Admin uniquement"}
          className={clsx(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
            enabled ? "bg-primary" : "bg-gray-300"
          )}
        >
          <span className={clsx("pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200", enabled ? "translate-x-5" : "translate-x-0")} />
        </button>
      </div>

      {/* Flow diagram */}
      <div className="bg-bg rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Workflow</p>
        <div className="space-y-2">
          {[
            { from: "NRP", delay: `> ${preview?.params?.nrpDelayH ?? 48}h`, color: "border-orange-300 bg-orange-50 text-orange-700" },
            { from: "FAUX NUM", delay: `> ${preview?.params?.fauxDelayH ?? 48}h`, color: "border-red-200 bg-red-50 text-red-700" },
            { from: "PAS INTERESSE", delay: `> ${preview?.params?.piDelayD ?? 90}j`, color: "border-gray-300 bg-gray-50 text-gray-600" },
          ].map((row) => (
            <div key={row.from} className="flex items-center gap-1 flex-wrap">
              <FlowStep label={row.from} color={row.color} />
              <Arrow label={row.delay} />
              <FlowStep label="À RAPPELER" color="border-primary/40 bg-primary/5 text-primary" />
              <span className="text-[10px] text-muted ml-2">→ réintègre la file d'appel</span>
            </div>
          ))}
        </div>
      </div>

      {/* Protections */}
      <div className="bg-bg rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={13} className="text-green-600" />
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Protections actives</p>
        </div>
        <ul className="space-y-1">
          {[
            "Clients verrouillés 🔒 → ignorés",
            "Clients avec RDV futur → ignorés",
            "Statuts RDV PRIS / RDV CONFIRMÉ → ignorés",
            "Clients archivés / supprimés → ignorés",
            "Limite : 50 PAS INTERESSE max par exécution",
          ].map((p) => (
            <li key={p} className="flex items-center gap-2 text-xs text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{p}
            </li>
          ))}
        </ul>
      </div>

      {/* Aperçu temps réel */}
      <div className="bg-bg rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-primary" />
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Aperçu — si exécuté maintenant</p>
          </div>
          <button onClick={loadPreview} className="text-xs text-primary hover:underline flex items-center gap-1">
            <RefreshCw size={11} className={loadingPreview ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>

        {loadingPreview ? (
          <p className="text-xs text-muted">Calcul en cours...</p>
        ) : preview ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "NRP", count: preview.counts.nrp, color: "bg-orange-50 text-orange-700 border-orange-200" },
                { label: "FAUX NUM", count: preview.counts.faux, color: "bg-red-50 text-red-700 border-red-200" },
                { label: "PAS INTERESSE", count: preview.counts.pi, color: "bg-gray-50 text-gray-700 border-gray-200" },
              ].map((c) => (
                <div key={c.label} className={clsx("rounded-lg border px-3 py-2 text-center", c.color)}>
                  <p className="text-lg font-bold">{c.count}</p>
                  <p className="text-[10px] font-medium">{c.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">
                Total : <span className="text-primary">{preview.counts.total} client{preview.counts.total > 1 ? "s" : ""}</span> seraient relancés
              </p>
              {preview.counts.total > 0 && (
                <button onClick={() => setShowPreviewTable(p => !p)} className="text-xs text-primary flex items-center gap-1 hover:underline">
                  {showPreviewTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {showPreviewTable ? "Masquer" : "Voir la liste"}
                </button>
              )}
            </div>

            {/* Table détail */}
            {showPreviewTable && preview.counts.total > 0 && (
              <div className="border border-border rounded-lg overflow-hidden mt-1">
                <table className="w-full text-xs">
                  <thead className="bg-bg border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-muted font-medium">Client</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">Mobile</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">Statut</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">Depuis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.preview.nrp.map((c: any) => ({ ...c, statut: "NRP" })),
                       ...preview.preview.faux.map((c: any) => ({ ...c, statut: "FAUX NUM" })),
                       ...preview.preview.pi.map((c: any) => ({ ...c, statut: "PAS INTERESSE" })),
                    ].map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                        <td className="px-3 py-2 font-medium">{c.firstName} {c.lastName}</td>
                        <td className="px-3 py-2 text-muted">{c.mobile || "—"}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold">{c.statut}</span></td>
                        <td className="px-3 py-2 text-muted">{Math.round((Date.now() - new Date(c.updatedAt).getTime()) / 3600000)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Planning */}
      <div className="flex items-center gap-2 text-xs text-muted bg-bg rounded-lg px-4 py-2.5">
        <Clock size={12} />
        <span>Exécution programmée : <strong>chaque jour à 9h00</strong> (France) — cron désactivé en attente d&apos;approbation</span>
      </div>
    </div>
  );
}

// ── Assignation manuelle (leads non assignés) ────────────────────────────────
function AssignationManuellePanel({ isAdmin, autoAssignEnabled }: {
  isAdmin: boolean;
  autoAssignEnabled: boolean;
}) {
  const [data, setData] = useState<{ unassignedCount: number; teleprosCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/telepros/assign-batch");
    const d = await r.json();
    setData(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAssign = async () => {
    if (!confirm(`Assigner ${data?.unassignedCount} lead(s) aux télépros actifs ?`)) return;
    setAssigning(true);
    setResult(null);
    const r = await fetch("/api/telepros/assign-batch", { method: "POST" });
    const d = await r.json();
    setResult(d.message || "Assignation terminée.");
    await load();
    setAssigning(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <h4 className="text-sm font-semibold">Répartition des leads</h4>
        {autoAssignEnabled ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">AUTO ✅</span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MANUELLE</span>
        )}
      </div>

      {autoAssignEnabled ? (
        <p className="text-xs text-muted">
          L&apos;assignation automatique est <strong>activée</strong>. Chaque nouveau lead est attribué au télépros le moins chargé dès son arrivée.
        </p>
      ) : (
        <p className="text-xs text-muted">
          L&apos;assignation automatique est <strong>désactivée</strong>. Activez le toggle ci-dessus pour laisser David gérer la répartition, ou utilisez le bouton ci-dessous pour assigner manuellement.
        </p>
      )}

      <div className="flex items-center justify-between bg-bg rounded-lg px-4 py-3">
        <div>
          {loading ? (
            <p className="text-sm text-muted">Chargement...</p>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {data?.unassignedCount ?? 0} lead(s) non assignés
              </p>
              <p className="text-xs text-muted mt-0.5">
                {data?.teleprosCount ?? 0} télépros actif(s) disponible(s)
              </p>
            </>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={handleAssign}
            disabled={assigning || (data?.unassignedCount ?? 0) === 0 || (data?.teleprosCount ?? 0) === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigning ? <RefreshCw size={13} className="animate-spin" /> : <Users size={13} />}
            Assigner maintenant
          </button>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Check size={12} />
          {result}
        </div>
      )}
    </div>
  );
}
