"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Download, ChevronLeft, ChevronRight, X, Edit2, Trash2, Receipt,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import clsx from "clsx";

const EXPENSE_STATUSES = [
  { value: "en_attente", label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  { value: "payé", label: "Payé", color: "bg-green-100 text-green-700" },
  { value: "annulé", label: "Annulé", color: "bg-red-100 text-red-700" },
];

export default function DepensesView({ userRole }: { userRole: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(), limit: "25", search, status: statusFilter,
    });
    const res = await fetch(`/api/expenses?${params}`);
    const data = await res.json();
    setExpenses(data.expenses || []);
    setTotal(data.pagination?.total || 0);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSave = async () => {
    const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
    const method = editingId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setEditingId(null);
    setForm({});
    fetchExpenses();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette dépense ?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    fetchExpenses();
  };

  const openEdit = (exp: any) => {
    setForm({
      ...exp,
      date: exp.date ? new Date(exp.date).toISOString().split("T")[0] : "",
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const getStatusStyle = (status: string) => {
    return EXPENSE_STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-700";
  };

  // Total amount for current page
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (!sortField) return 0;

    let aVal: any = a[sortField as keyof typeof a];
    let bVal: any = b[sortField as keyof typeof b];

    // Handle nested client field
    if (sortField === "client") {
      aVal = a.client ? `${a.client.firstName || ""} ${a.client.lastName || ""}` : "";
      bVal = b.client ? `${b.client.firstName || ""} ${b.client.lastName || ""}` : "";
    }

    if (aVal === null || aVal === undefined) aVal = "";
    if (bVal === null || bVal === undefined) bVal = "";

    // Numeric sorting for amount
    if (sortField === "amount") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Date sorting
    if (sortField === "date") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Text sorting with French locale
    const comparison = String(aVal).localeCompare(String(bVal), "fr", { sensitivity: "base" });
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setForm({}); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Nouvelle dépense
          </button>
          <span className="text-sm text-muted">
            <span className="font-semibold text-secondary">{total}</span> dépenses
            {totalAmount > 0 && (
              <span className="ml-2 text-xs">— Total page: <span className="font-semibold text-secondary">{totalAmount.toFixed(2)} €</span></span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Fournisseur, client..." className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-44" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="">Tous statuts</option>
            {EXPENSE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted hover:text-secondary">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Date
                  {sortField === "date" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("supplier")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Fournisseur
                  {sortField === "supplier" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("client")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Client
                  {sortField === "client" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("bank")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Banque
                  {sortField === "bank" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("amount")} className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full">
                  Montant
                  {sortField === "amount" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("matching")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Lettrage
                  {sortField === "matching" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("status")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Statut
                  {sortField === "status" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("observation")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Observation
                  {sortField === "observation" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-16 text-center text-muted">Chargement...</td></tr>
            ) : sortedExpenses.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center text-muted">
                <Receipt size={40} className="mx-auto mb-2 text-border" />
                Aucune dépense
              </td></tr>
            ) : sortedExpenses.map((exp) => (
              <tr key={exp.id} className="border-b border-border/50 hover:bg-bg/50 transition-colors">
                <td className="py-3 px-4 text-sm text-muted">
                  {exp.date ? new Date(exp.date).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="py-3 px-4 text-sm font-medium text-secondary">{exp.supplier || "—"}</td>
                <td className="py-3 px-4 text-sm">
                  {exp.client ? `${exp.client.firstName} ${exp.client.lastName}` : "—"}
                </td>
                <td className="py-3 px-4 text-sm text-muted">{exp.bank || "—"}</td>
                <td className="py-3 px-4 text-sm font-semibold text-right">
                  {exp.amount > 0 ? `${exp.amount.toFixed(2)} €` : "—"}
                </td>
                <td className="py-3 px-4 text-sm text-muted">{exp.matching || "—"}</td>
                <td className="py-3 px-4">
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", getStatusStyle(exp.status))}>
                    {EXPENSE_STATUSES.find((s) => s.value === exp.status)?.label || exp.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-muted max-w-xs truncate">{exp.observation || "—"}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(exp)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"><Edit2 size={15} /></button>
                    {userRole === "admin" && (
                      <button onClick={() => handleDelete(exp.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger"><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">Page {page}/{totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-bg disabled:opacity-30"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-bg disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">{editingId ? "Modifier dépense" : "Nouvelle dépense"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-bg rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Date</label>
                <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Fournisseur</label>
                <input type="text" value={form.supplier || ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="Nom fournisseur" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Montant (€)</label>
                <input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Statut</label>
                <select value={form.status || "en_attente"} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                  {EXPENSE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Banque</label>
                <input type="text" value={form.bank || ""} onChange={(e) => setForm({ ...form, bank: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Lettrage</label>
                <input type="text" value={form.matching || ""} onChange={(e) => setForm({ ...form, matching: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Observation</label>
                <textarea value={form.observation || ""} onChange={(e) => setForm({ ...form, observation: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-none" rows={3} />
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
