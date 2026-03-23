"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Download, ChevronLeft, ChevronRight,
  LogIn, Edit, ArrowRightLeft, MessageSquare, UserPlus, RotateCcw,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import clsx from "clsx";

const ACTION_TYPES = [
  { value: "", label: "Toutes les actions" },
  { value: "connexion", label: "Connexion" },
  { value: "modification", label: "Modification" },
  { value: "changement_statut", label: "Changement de statut" },
  { value: "creation", label: "Création" },
  { value: "ajout_commentaire", label: "Commentaire" },
];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  connexion: <LogIn size={14} className="text-blue-500" />,
  modification: <Edit size={14} className="text-orange-500" />,
  changement_statut: <ArrowRightLeft size={14} className="text-purple-500" />,
  creation: <UserPlus size={14} className="text-green-500" />,
  ajout_commentaire: <MessageSquare size={14} className="text-cyan-500" />,
};

interface ActionUser {
  id: number;
  name: string;
}

interface ActionClient {
  id: number;
  firstName: string | null;
  lastName: string | null;
}

interface Action {
  id: number;
  type: string;
  detail: string;
  createdAt: string;
  user?: ActionUser | null;
  client?: ActionClient | null;
  [key: string]: unknown;
}

interface ActionUserOption {
  id: number;
  name: string;
}

export default function ActionsLog() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const [users, setUsers] = useState<ActionUserOption[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchActions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "50",
      client: clientSearch,
      type: actionType,
      userId: userFilter,
    });

    const res = await fetch(`/api/actions?${params}`);
    const data = await res.json();
    setActions(data.actions || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setTotal(data.pagination?.total || 0);
    setLoading(false);
  }, [page, clientSearch, actionType, userFilter]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []));
  }, []);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedActions = [...actions].sort((a, b) => {
    if (!sortField) return 0;

    let aVal: string | number | null = a[sortField as keyof typeof a] as string | number | null;
    let bVal: string | number | null = b[sortField as keyof typeof b] as string | number | null;

    // Handle nested fields (user.name, client.firstName)
    if (sortField === "user") {
      aVal = a.user?.name || "";
      bVal = b.user?.name || "";
    } else if (sortField === "client") {
      aVal = a.client ? `${a.client.firstName || ""} ${a.client.lastName || ""}` : "";
      bVal = b.client ? `${b.client.firstName || ""} ${b.client.lastName || ""}` : "";
    }

    if (aVal === null || aVal === undefined) aVal = "";
    if (bVal === null || bVal === undefined) bVal = "";

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher client..."
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-44"
            />
          </div>

          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            <option value="">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={actionType}
            onChange={(e) => { setActionType(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            {ACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-muted">
            <span className="font-semibold text-secondary">{total}</span> actions
          </span>
          <button className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted hover:text-secondary transition-colors">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full sm:min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-bg/50">
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
                <button onClick={() => handleSort("detail")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Détail
                  {sortField === "detail" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="hidden sm:table-cell text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("user")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Utilisateur
                  {sortField === "user" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="hidden sm:table-cell text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("client")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Client
                  {sortField === "client" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="hidden sm:table-cell text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("oldStatus")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Ancien statut
                  {sortField === "oldStatus" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="hidden sm:table-cell text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button onClick={() => handleSort("newStatus")} className="flex items-center gap-1 hover:text-secondary transition-colors">
                  Nouveau statut
                  {sortField === "newStatus" ? (
                    sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-muted">Chargement...</td>
              </tr>
            ) : sortedActions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-muted">Aucune action</td>
              </tr>
            ) : (
              sortedActions.map((action) => (
                <tr key={action.id} className="border-b border-border/50 hover:bg-bg/50 transition-colors">
                  <td className="py-2.5 px-4 text-xs text-muted whitespace-nowrap">
                    {formatDateTime(action.createdAt)}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      {ACTION_ICONS[action.type] || <Edit size={14} className="text-gray-400" />}
                      <span className="text-xs text-muted capitalize">
                        {action.type.replace(/_/g, " ")}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-sm text-secondary max-w-xs truncate">
                    {action.detail}
                  </td>
                  <td className="hidden sm:table-cell py-2.5 px-4 text-sm font-medium text-secondary">
                    {action.user?.name || "—"}
                  </td>
                  <td className="hidden sm:table-cell py-2.5 px-4 text-sm text-primary">
                    {action.client
                      ? `${action.client.firstName || ""} ${action.client.lastName || ""}`
                      : "—"}
                  </td>
                  <td className="hidden sm:table-cell py-2.5 px-4">
                    {action.oldStatus ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                        {action.oldStatus}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="hidden sm:table-cell py-2.5 px-4">
                    {action.newStatus ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                        {action.newStatus}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">Page {page}/{totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-bg disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-bg disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
