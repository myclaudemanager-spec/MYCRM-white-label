"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Edit2, Trash2, Shield, UserCheck, UserX } from "lucide-react";
import clsx from "clsx";
import type { User } from "@prisma/client";

const ROLES = [
  { value: "admin", label: "Administrateur", color: "bg-red-100 text-red-700" },
  { value: "telepos", label: "Télépos", color: "bg-blue-100 text-blue-700" },
  { value: "commercial", label: "Commercial", color: "bg-green-100 text-green-700" },
];

export default function UtilisateursView({ userRole, currentUserId }: { userRole: string; currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<User>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async () => {
    if (!form.name || !form.login || !form.email) return;
    if (!editingId && !form.password) return;

    const url = editingId ? `/api/users/${editingId}` : "/api/users";
    const method = editingId ? "PUT" : "POST";
    const payload = { ...form };
    if (editingId && !payload.password) delete payload.password;

    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setShowForm(false);
    setEditingId(null);
    setForm({});
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Désactiver cet utilisateur ?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  const toggleActive = async (u: User) => {
    await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    fetchUsers();
  };

  const openEdit = (u: User) => {
    setForm({ name: u.name, login: u.login, email: u.email, role: u.role, team: u.team || "" });
    setEditingId(u.id);
    setShowForm(true);
  };

  const getRoleStyle = (role: string) => {
    return ROLES.find((r) => r.value === role)?.color || "bg-gray-100 text-gray-700";
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const isAdmin = userRole === "admin";
  const activeUsers = users.filter((u) => u.active);
  const inactiveUsers = users.filter((u) => !u.active);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => { setForm({ role: "commercial" }); setEditingId(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Nouvel utilisateur
            </button>
          )}
          <span className="text-sm text-muted">
            <span className="font-semibold text-secondary">{activeUsers.length}</span> actifs
            {inactiveUsers.length > 0 && (
              <span className="ml-1">/ {inactiveUsers.length} inactifs</span>
            )}
          </span>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-16 text-center text-muted">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.id}
              className={clsx(
                "bg-card rounded-xl border p-5 transition-shadow",
                u.active ? "border-border hover:shadow-md" : "border-border/50 opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                    u.role === "admin" ? "bg-red-500" : u.role === "telepos" ? "bg-blue-500" : "bg-green-500"
                  )}>
                    {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-secondary text-sm">{u.name}</h4>
                    <p className="text-xs text-muted">{u.login}</p>
                  </div>
                </div>
                {isAdmin && u.id !== currentUserId && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => toggleActive(u)}
                      className={clsx("p-1.5 rounded-lg", u.active ? "hover:bg-danger/10 text-danger" : "hover:bg-green-100 text-green-600")}>
                      {u.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", getRoleStyle(u.role))}>
                    {getRoleLabel(u.role)}
                  </span>
                  <span className={clsx(
                    "flex items-center gap-1 text-xs font-medium",
                    u.active ? "text-green-600" : "text-gray-400"
                  )}>
                    <span className={clsx("w-1.5 h-1.5 rounded-full", u.active ? "bg-green-500" : "bg-gray-300")} />
                    {u.active ? "Actif" : "Inactif"}
                  </span>
                </div>

                <p className="text-xs text-muted">{u.email?.includes("@") ? u.email : "—"}</p>
                {u.team && <p className="text-xs text-muted">Equipe: {u.team}</p>}
                <p className="text-[10px] text-muted">
                  Créé le {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">{editingId ? "Modifier utilisateur" : "Nouvel utilisateur"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-bg rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Nom complet</label>
                <input type="text" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Prénom Nom" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Identifiant</label>
                <input type="text" value={form.login || ""} onChange={(e) => setForm({ ...form, login: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Identifiant de connexion" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Email</label>
                <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">
                  Mot de passe {editingId && <span className="text-[10px]">(laisser vide pour ne pas changer)</span>}
                </label>
                <input type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Rôle</label>
                  <select value={form.role || "commercial"} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Équipe</label>
                  <input type="text" value={form.team || ""} onChange={(e) => setForm({ ...form, team: e.target.value })}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Nom équipe" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-bg">Annuler</button>
              <button onClick={handleSave} className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm font-medium">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
