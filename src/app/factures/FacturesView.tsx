"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Download, ChevronLeft, ChevronRight, X, Edit2, Trash2, FileText,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import clsx from "clsx";

const INVOICE_TYPES = ["Facture", "Devis", "Avoir", "Acompte"];
const INVOICE_STATUSES = [
  { value: "brouillon", label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  { value: "envoyé", label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  { value: "payé", label: "Payé", color: "bg-green-100 text-green-700" },
  { value: "annulé", label: "Annulé", color: "bg-red-100 text-red-700" },
];

export default function FacturesView({ userRole }: { userRole: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(), limit: "25", search, type: typeFilter, status: statusFilter,
    });
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    setInvoices(data.invoices || []);
    setTotal(data.pagination?.total || 0);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSave = async () => {
    const url = editingId ? `/api/invoices/${editingId}` : "/api/invoices";
    const method = editingId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setEditingId(null);
    setForm({});
    fetchInvoices();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    fetchInvoices();
  };

  const openEdit = (inv: any) => {
    setForm(inv);
    setEditingId(inv.id);
    setShowForm(true);
  };

  const getStatusStyle = (status: string) => {
    return INVOICE_STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-700";
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
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

    // Numeric sorting for id and amount
    if (sortField === "id" || sortField === "amount") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Date sorting
    if (sortField === "createdAt") {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Text sorting with French locale
    const comparison = String(aVal).localeCompare(String(bVal), "fr", { sensitivity: "base" });
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const formatContent = (c: string | null | undefined) => {
    if (!c) return "—";
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => item.description || item.name || item.label || String(item)).join(", ") || "—";
      }
      return c;
    } catch { return c; }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setForm({}); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Nouvelle facture
          </button>
          <span className="text-sm text-muted"><span className="font-semibold text-secondary">{total}</span> factures</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Client ou N°..." className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-44" />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="">Tous types</option>
            {INVOICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm">
            <option value="">Tous statuts</option>
            {INVOICE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted hover:text-secondary">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("number")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  N°
                  {sortField === "number" ? (
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
                <button onClick={() => handleSort("type")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Type
                  {sortField === "type" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("content")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Contenu
                  {sortField === "content" ? (
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
                <button onClick={() => handleSort("createdAt")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Date
                  {sortField === "createdAt" ? (
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
              <tr><td colSpan={8} className="py-16 text-center text-muted">Chargement...</td></tr>
            ) : sortedInvoices.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-muted">
                <FileText size={40} className="mx-auto mb-2 text-border" />
                Aucune facture
              </td></tr>
            ) : sortedInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border/50 hover:bg-bg/50 transition-colors">
                <td className="py-3 px-4 text-sm font-mono font-medium text-secondary">{inv.number || `#${inv.id}`}</td>
                <td className="py-3 px-4 text-sm">{inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : "—"}</td>
                <td className="py-3 px-4 text-sm text-muted">{inv.type || "—"}</td>
                <td className="py-3 px-4 text-sm text-muted max-w-xs truncate">{formatContent(inv.content)}</td>
                <td className="py-3 px-4 text-sm font-semibold text-right">{inv.amount > 0 ? `${inv.amount.toFixed(2)} €` : "—"}</td>
                <td className="py-3 px-4">
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", getStatusStyle(inv.status))}>
                    {INVOICE_STATUSES.find((s) => s.value === inv.status)?.label || inv.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-muted">{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary"><Edit2 size={15} /></button>
                    {userRole === "admin" && (
                      <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger"><Trash2 size={15} /></button>
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
              <h3 className="text-lg font-semibold">{editingId ? "Modifier facture" : "Nouvelle facture"}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-bg rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">N° Facture</label>
                <input type="text" value={form.number || ""} onChange={(e) => setForm({ ...form, number: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="FAC-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Type</label>
                <select value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                  <option value="">—</option>
                  {INVOICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Montant (€)</label>
                <input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Statut</label>
                <select value={form.status || "brouillon"} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm">
                  {INVOICE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">ID Transaction bancaire</label>
                <input type="text" value={form.bankTransId || ""} onChange={(e) => setForm({ ...form, bankTransId: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Contenu</label>
                <textarea value={form.content || ""} onChange={(e) => setForm({ ...form, content: e.target.value })}
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
