"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Plus, Download, Filter, X, ChevronLeft, ChevronRight,
  Phone, MessageSquare, Eye, ArrowUpDown, ArrowUp, ArrowDown, Zap,
  MapPin, MessageCircle, Upload, CheckSquare, Square, Minus
} from "lucide-react";
import clsx from "clsx";
import ClientModal from "./ClientModal";
import CallPanel from "@/components/CallPanel";
import SavedFilters from "@/components/SavedFilters";
import QuickQualifyModal from "@/components/QuickQualifyModal";
import CsvImportModal from "@/components/CsvImportModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Client {
  id: number;
  clientNumber: number | null;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  phone1: string | null;
  email: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  statusCall: string | null;
  statusRDV: string | null;
  team: string | null;
  campaign: string | null;
  observation: string | null;
  updatedAt: string;
  rappelDate: string | null;
  rappelTime: string | null;
  leadScore: number | null;
  leadPriority: string | null;
  lastCommentText: string | null;
  lastCommentAt: string | null;
  commercial1: { id: number; name: string } | null;
  telepos: { id: number; name: string } | null;
  callLogs?: { comment: string | null; result: string; createdAt: string; callTime: string }[];
}

interface Status {
  id: number;
  type: string;
  name: string;
  color: string;
}

interface ClientsPageProps {
  userId: number;
  userRole: string;
}

const RESULT_LABELS: Record<string, string> = {
  RDV_PRIS: "RDV pris",
  NRP: "NRP",
  A_RAPPELER: "À rappeler",
  PAS_INTERESSE: "Pas intéressé",
  FAUX_NUMERO: "Faux numéro",
  "RDV_CONFIRMÉ": "RDV Confirmé",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}j`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function ClientsPage({ userId, userRole }: ClientsPageProps) {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusCallFilter, setStatusCallFilter] = useState(() => searchParams.get("statusCall") || "");
  const [statusRDVFilter, setStatusRDVFilter] = useState(() => searchParams.get("statusRDV") || "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [callPanelOpen, setCallPanelOpen] = useState<{ clientId: number; name: string; phone: string } | null>(null);
  const [quickQualifyOpen, setQuickQualifyOpen] = useState<{ id: number; firstName?: string | null; lastName?: string | null; mobile?: string | null } | null>(null);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [rappelTodayFilter, setRappelTodayFilter] = useState(false);
  const [rappelTodayCount, setRappelTodayCount] = useState(0);
  // Inline status change
  const [inlineStatusClient, setInlineStatusClient] = useState<number | null>(null);
  // Tooltip comment popup
  const [tooltipClient, setTooltipClient] = useState<Client | null>(null);
  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStatusCall, setBulkStatusCall] = useState("");
  const [bulkStatusRDV, setBulkStatusRDV] = useState("");
  const [bulkIsOwner, setBulkIsOwner] = useState("");
  const [bulkTeleposId, setBulkTeleposId] = useState("");
  const [users, setUsers] = useState<{ id: number; name: string; role: string }[]>([]);

  useEffect(() => {
    const openClient = searchParams.get("openClient");
    if (openClient) setSelectedClient(parseInt(openClient));
  }, [searchParams]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: "25", search, statusCall: statusCallFilter, statusRDV: statusRDVFilter, sortBy, sortOrder });
    if (rappelTodayFilter) params.set("rappelToday", "true");
    const res = await fetch(`/api/clients?${params}`);
    const data = await res.json();
    setClients(data.clients);
    setTotalPages(data.pagination.totalPages);
    setTotal(data.pagination.total);
    if (data.rappelTodayCount !== undefined) setRappelTodayCount(data.rappelTodayCount);
    setLoading(false);
  }, [page, search, statusCallFilter, statusRDVFilter, sortBy, sortOrder, rappelTodayFilter]);

  useEffect(() => { fetchClients(); setSelectedIds(new Set()); }, [fetchClients]);

  useEffect(() => {
    fetch("/api/statuses").then(r => r.json()).then(d => setStatuses(d.statuses));
    fetch("/api/users").then(r => r.json()).then(d => { if (d.users) setUsers(d.users.filter((u: any) => u.active !== false)); }).catch(() => {});
  }, []);

  const resetFilters = () => { setSearch(""); setStatusCallFilter(""); setStatusRDVFilter(""); setRappelTodayFilter(false); setPage(1); };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortOrder("asc"); }
    setPage(1);
  };

  // Inline status change
  const handleInlineStatusChange = async (clientId: number, newStatus: string) => {
    setInlineStatusClient(null);
    await fetch(`/api/clients/${clientId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusCall: newStatus }) });
    fetchClients();
  };

  // Multi-selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(clients.map(c => c.id)));
  };
  const clearSelection = () => { setSelectedIds(new Set()); setBulkStatusCall(""); setBulkStatusRDV(""); setBulkIsOwner(""); setBulkTeleposId(""); };

  // Bulk update
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    const updates: Record<string, string> = {};
    if (bulkStatusCall) updates.statusCall = bulkStatusCall;
    if (bulkStatusRDV) updates.statusRDV = bulkStatusRDV;
    if (bulkIsOwner) updates.isOwner = bulkIsOwner;
    if (bulkTeleposId) updates.teleposId = bulkTeleposId;
    if (Object.keys(updates).length === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/clients/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      });
      const data = await res.json();
      if (data.success) {
        clearSelection();
        fetchClients();
      }
    } catch (e) { console.error("Bulk update error:", e); }
    setBulkUpdating(false);
  };

  useKeyboardShortcuts([
    { key: "n", ctrlKey: true, action: () => setShowNewModal(true), description: "Nouveau client" },
    { key: "q", action: () => {
      const firstNew = clients.find(c => c.statusCall === "NEW" || c.statusCall === null);
      if (firstNew) setQuickQualifyOpen({ id: firstNew.id, firstName: firstNew.firstName, lastName: firstNew.lastName, mobile: firstNew.mobile });
    }, description: "Qualification Express" },
    { key: "Escape", action: () => { setSelectedClient(null); setShowNewModal(false); setCallPanelOpen(null); setQuickQualifyOpen(null); setInlineStatusClient(null); clearSelection(); }, description: "Fermer" },
  ]);

  const getStatusBadge = (statusName: string | null, type: "statut1" | "statut2") => {
    if (!statusName) return null;
    const status = statuses.find(s => s.name === statusName && s.type === type);
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white whitespace-nowrap" style={{ backgroundColor: status?.color || "#94a3b8" }}>
        {statusName}
      </span>
    );
  };

  const statut1List = statuses.filter(s => s.type === "statut1");
  const statut2List = statuses.filter(s => s.type === "statut2");

  const SortIcon = ({ field }: { field: string }) => sortBy === field ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Top bar ─── */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchClients(); }} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button type="submit" className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors whitespace-nowrap">
              <Search size={14} className="sm:hidden" />
              <span className="hidden sm:inline">Chercher</span>
            </button>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {rappelTodayCount > 0 && (
              <button
                onClick={() => { setRappelTodayFilter(!rappelTodayFilter); setPage(1); }}
                className={clsx("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors font-medium",
                  rappelTodayFilter ? "bg-purple-100 border-purple-400 text-purple-700" : "border-purple-300 text-purple-600 hover:bg-purple-50"
                )}
              >
                📞 <span>{rappelTodayCount} Rappels</span>
              </button>
            )}
            <button onClick={() => setShowFilters(!showFilters)}
              className={clsx("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors",
                showFilters ? "bg-primary/10 border-primary text-primary" : "border-border text-muted hover:border-primary hover:text-primary"
              )}>
              <Filter size={14} /><span className="hidden sm:inline">Filtres</span>
            </button>
            <button onClick={() => setShowCsvImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Upload size={14} /><span className="hidden sm:inline">Importer CSV</span>
            </button>
            <button onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
              <Plus size={14} /><span className="hidden sm:inline">Nouveau</span>
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted">
          <span>{total} lead{total > 1 ? "s" : ""}</span>
          <span className="hidden sm:inline">Page {page}/{totalPages}</span>
          {rappelTodayFilter && <span className="text-purple-600 font-semibold">📞 Rappels du jour</span>}
          {(statusCallFilter || statusRDVFilter || search || rappelTodayFilter) && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-danger hover:underline"><X size={10} />Effacer filtres</button>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 bg-blue-50/50 -mx-4 px-4 pb-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selectionne{selectedIds.size > 1 ? "s" : ""}</span>
            <select value={bulkStatusCall} onChange={e => setBulkStatusCall(e.target.value)}
              className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Statut Call...</option>
              {statut1List.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={bulkStatusRDV} onChange={e => setBulkStatusRDV(e.target.value)}
              className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Statut RDV...</option>
              {statut2List.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={bulkIsOwner} onChange={e => setBulkIsOwner(e.target.value)}
              className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Proprio maison...</option>
              <option value="Oui">Oui (proprio maison)</option>
              <option value="Non">Non (pas eligible)</option>
            </select>
            <select value={bulkTeleposId} onChange={e => setBulkTeleposId(e.target.value)}
              className="px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Telepro...</option>
              {users.filter(u => u.role === "telepos" || u.role === "admin").map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button onClick={handleBulkUpdate} disabled={bulkUpdating || (!bulkStatusCall && !bulkStatusRDV && !bulkIsOwner && !bulkTeleposId)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {bulkUpdating ? "..." : "Appliquer"}
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 text-xs text-blue-600 hover:underline">Annuler</button>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Statut Call</label>
              <select value={statusCallFilter} onChange={(e) => { setStatusCallFilter(e.target.value); setPage(1); }}
                className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Tous</option>
                {statut1List.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                <option value="HORS ZONE">HORS ZONE</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Statut RDV</label>
              <select value={statusRDVFilter} onChange={(e) => { setStatusRDVFilter(e.target.value); setPage(1); }}
                className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Tous</option>
                {statut2List.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ─── Table / Cards ─── */}
      <div className="flex-1 overflow-auto">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                <th className="py-3 px-2 text-center w-10">
                  <button onClick={toggleSelectAll} className="p-1 rounded hover:bg-bg transition-colors text-muted hover:text-primary">
                    {selectedIds.size === 0 ? <Square size={16} /> : selectedIds.size === clients.length ? <CheckSquare size={16} className="text-blue-600" /> : <Minus size={16} className="text-blue-600" />}
                  </button>
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-12"><button onClick={() => handleSort("clientNumber")} className="flex items-center gap-1 hover:text-primary"># <SortIcon field="clientNumber" /></button></th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  <button onClick={() => handleSort("lastName")} className="flex items-center gap-1 hover:text-primary">Client <SortIcon field="lastName" /></button>
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  <button onClick={() => handleSort("leadScore")} className="flex items-center gap-1 hover:text-primary">Score <SortIcon field="leadScore" /></button>
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Téléphone</th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  <button onClick={() => handleSort("city")} className="flex items-center gap-1 hover:text-primary">Ville <SortIcon field="city" /></button>
                </th>
                {rappelTodayFilter && <th className="py-3 px-3 text-left text-xs font-semibold text-purple-600 uppercase tracking-wider">🕐 Heure rappel</th>}
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Statut Call</th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Statut RDV</th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Dernier commentaire</th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  <button onClick={() => handleSort("updatedAt")} className="flex items-center gap-1 hover:text-primary">Modifié <SortIcon field="updatedAt" /></button>
                </th>
                <th className="py-3 px-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="py-3 px-3"><div className="h-4 bg-border/50 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-muted">Aucun client trouvé</td></tr>
              ) : clients.map(client => {
                const lastCall = client.callLogs?.[0];
                return (
                  <tr key={client.id} className={clsx("border-b border-border/30 hover:bg-primary/[0.02] transition-colors cursor-pointer group", selectedIds.has(client.id) && "bg-blue-50/50")}
                    onClick={() => setSelectedClient(client.id)}>
                    <td className="py-3 px-2 text-center" onClick={e => { e.stopPropagation(); toggleSelect(client.id); }}>
                      <button className="p-1 rounded hover:bg-bg transition-colors">
                        {selectedIds.has(client.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-muted/40" />}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-xs text-muted font-mono">#{client.clientNumber ?? client.id}</td>
                    <td className="py-3 px-3">
                      <div>
                        <p className="text-sm font-medium text-secondary">{client.lastName} {client.firstName}</p>
                        {client.email && <p className="text-xs text-muted truncate max-w-[180px]">{client.email}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {client.leadScore != null ? (
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-semibold",
                          client.leadPriority === "TRÈS HAUTE" ? "bg-green-100 text-green-700" :
                          client.leadPriority === "HAUTE" ? "bg-lime-100 text-lime-700" :
                          client.leadPriority === "MOYENNE" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        )}>{client.leadScore}/100</span>
                      ) : <span className="text-xs text-muted">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      {client.mobile && (
                        <button onClick={(e) => { e.stopPropagation(); setCallPanelOpen({ clientId: client.id, name: `${client.lastName || ""} ${client.firstName || ""}`.trim(), phone: client.mobile! }); }}
                          className="flex items-center gap-1 text-primary hover:underline text-sm font-medium">
                          <Phone size={12} /> {client.mobile}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {(client.city || client.zipCode) && (
                        <span className="text-xs text-muted flex items-center gap-1"><MapPin size={10} />{client.zipCode} {client.city}</span>
                      )}
                    </td>
                    {rappelTodayFilter && (
                      <td className="py-3 px-3">
                        {client.rappelTime ? (
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                            🕐 {client.rappelTime}
                          </span>
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                    )}
                    {/* Statut Call — clic pour changer inline */}
                    <td className="py-3 px-3" onClick={(e) => { e.stopPropagation(); setInlineStatusClient(inlineStatusClient === client.id ? null : client.id); }}>
                      <div className="relative">
                        {getStatusBadge(client.statusCall, "statut1") || <span className="text-xs text-muted italic">—</span>}
                        {inlineStatusClient === client.id && (
                          <div className="absolute z-30 top-6 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                            {statut1List.map(s => (
                              <button key={s.id} onClick={(e) => { e.stopPropagation(); handleInlineStatusChange(client.id, s.name); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-bg flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </button>
                            ))}
                            <button onClick={(e) => { e.stopPropagation(); handleInlineStatusChange(client.id, "HORS ZONE"); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-bg text-red-600">
                              🚫 HORS ZONE
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(client.statusRDV, "statut2")}</td>
                    {/* Dernier commentaire */}
                    <td className="py-3 px-3 max-w-[200px]">
                      {(client.lastCommentText || lastCall?.comment) ? (
                        <div className="relative group/comment">
                          <p className="text-xs text-muted truncate cursor-help">
                            <MessageSquare size={10} className="inline mr-1 text-primary/50" />
                            {client.lastCommentText || lastCall?.comment}
                          </p>
                          {/* Tooltip */}
                          <div className="absolute z-40 bottom-6 left-0 bg-secondary text-white text-xs rounded-lg p-2 min-w-[200px] max-w-[300px] shadow-xl hidden group-hover/comment:block pointer-events-none">
                            {client.lastCommentText || lastCall?.comment}
                            {client.lastCommentAt && <p className="text-white/60 mt-1">{formatTimeAgo(client.lastCommentAt)}</p>}
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted/40">—</span>}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted">{formatDate(client.updatedAt)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedClient(client.id); }}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Voir">
                          <Eye size={15} />
                        </button>
                        {client.mobile && (
                          <button onClick={(e) => { e.stopPropagation(); setCallPanelOpen({ clientId: client.id, name: `${client.lastName || ""} ${client.firstName || ""}`.trim(), phone: client.mobile! }); }}
                            className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors" title="Appeler">
                            <Phone size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-border/50 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-border/50 rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : clients.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">Aucun client trouvé</div>
          ) : clients.map(client => {
            const lastCall = client.callLogs?.[0];
            return (
              <div key={client.id} className="p-4 hover:bg-bg/50 transition-colors" onClick={() => setSelectedClient(client.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-secondary truncate">{client.lastName} {client.firstName}</p>
                      {client.leadScore != null && (
                        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                          client.leadPriority === "TRÈS HAUTE" ? "bg-green-100 text-green-700" :
                          client.leadPriority === "HAUTE" ? "bg-lime-100 text-lime-700" :
                          client.leadPriority === "MOYENNE" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                        )}>{client.leadScore}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {getStatusBadge(client.statusCall, "statut1")}
                      {getStatusBadge(client.statusRDV, "statut2")}
                    </div>
                    {client.mobile && (
                      <button onClick={(e) => { e.stopPropagation(); setCallPanelOpen({ clientId: client.id, name: `${client.lastName || ""} ${client.firstName || ""}`.trim(), phone: client.mobile! }); }}
                        className="flex items-center gap-1 text-primary text-sm font-medium">
                        <Phone size={13} /> {client.mobile}
                      </button>
                    )}
                    {(client.lastCommentText || lastCall?.comment) && (
                      <p className="text-xs text-muted mt-1.5 line-clamp-2">
                        <MessageSquare size={10} className="inline mr-1" />{client.lastCommentText || lastCall?.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted/60 mt-1">
                      <span className="font-mono">#{client.clientNumber ?? client.id}</span> · {client.zipCode} {client.city} · {formatDate(client.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedClient(client.id); }}
                      className="p-2 rounded-lg bg-primary/10 text-primary"><Eye size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border sticky bottom-0 bg-card">
            <p className="text-xs text-muted">Page {page}/{totalPages} · {total} leads</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="p-2 rounded-lg hover:bg-bg disabled:opacity-30 transition-colors"><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={clsx("w-8 h-8 rounded-lg text-xs transition-colors", p === page ? "bg-primary text-white" : "hover:bg-bg text-muted")}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-bg disabled:opacity-30 transition-colors"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedClient && (
        <ClientModal clientId={selectedClient} onClose={() => setSelectedClient(null)} onSaved={() => { setSelectedClient(null); fetchClients(); }} userRole={userRole} />
      )}
      {showCsvImport && (
        <CsvImportModal onClose={() => setShowCsvImport(false)} onSuccess={() => { setShowCsvImport(false); fetchClients(); }} />
      )}
      {showNewModal && (
        <ClientModal clientId={null} onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); fetchClients(); }} userRole={userRole} />
      )}
      {callPanelOpen && (
        <CallPanel clientId={callPanelOpen.clientId} clientName={callPanelOpen.name} phoneNumber={callPanelOpen.phone}
          onClose={() => setCallPanelOpen(null)} onCallCompleted={() => { setCallPanelOpen(null); fetchClients(); }} />
      )}
      {quickQualifyOpen && (
        <QuickQualifyModal isOpen={true} onClose={() => setQuickQualifyOpen(null)} client={quickQualifyOpen}
          onSuccess={() => { setQuickQualifyOpen(null); fetchClients(); }} />
      )}

      {/* Click outside to close inline status */}
      {inlineStatusClient && <div className="fixed inset-0 z-20" onClick={() => setInlineStatusClient(null)} />}
    </div>
  );
}
