"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  MousePointer,
  Eye,
  DollarSign,
  Target,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import clsx from "clsx";

// Taux de conversion AED → EUR (source: XE.com)
const AED_TO_EUR = 0.25; // 1 AED ≈ 0.25 EUR (ou 1 EUR ≈ 4 AED)

/**
 * Formater un montant en AED avec conversion EUR
 * Exemple: "1000 AED (250 €)"
 */
function formatCurrency(aedAmount: number, decimals: number = 2): string {
  const eurAmount = aedAmount * AED_TO_EUR;
  return `${aedAmount.toFixed(decimals)} AED (${eurAmount.toFixed(decimals)} €)`;
}

interface CampaignInsights {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  cost_per_lead: number;
}

interface Campaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  objective: string;
  created_time: string;
  updated_time: string;
  insights: CampaignInsights | null;
}

interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export default function FacebookAdsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("last_30d");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/facebook-ads/campaigns?${params}`);
      const data = await res.json();

      if (data.success) {
        setCampaigns(data.campaigns || []);
        setTotals(data.totals || null);
      }
    } catch (error) {
      console.error("Erreur fetch campagnes:", error);
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    if (!sortField) return 0;

    let aVal: any;
    let bVal: any;

    // Handle nested insights fields
    if (sortField.startsWith("insights.")) {
      const field = sortField.replace("insights.", "");
      aVal = a.insights?.[field as keyof CampaignInsights] ?? 0;
      bVal = b.insights?.[field as keyof CampaignInsights] ?? 0;
    } else {
      aVal = a[sortField as keyof Campaign];
      bVal = b[sortField as keyof Campaign];
    }

    if (aVal === null || aVal === undefined) aVal = sortField.startsWith("insights.") ? 0 : "";
    if (bVal === null || bVal === undefined) bVal = sortField.startsWith("insights.") ? 0 : "";

    // Numeric sorting
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Text sorting
    const comparison = String(aVal).localeCompare(String(bVal), "fr", {
      sensitivity: "base",
    });
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const periodLabel = {
    last_7d: "7 derniers jours",
    last_30d: "30 derniers jours",
    last_90d: "90 derniers jours",
  }[period];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-secondary">
            Analytics Facebook Ads
          </h1>
          <p className="text-sm text-muted mt-1">
            Suivi des performances publicitaires · {periodLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            <option value="last_7d">7 derniers jours</option>
            <option value="last_30d">30 derniers jours</option>
            <option value="last_90d">90 derniers jours</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actives</option>
            <option value="PAUSED">Pausées</option>
          </select>

          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase">
                Dépenses totales
              </span>
              <DollarSign size={18} className="text-primary" />
            </div>
            <div className="text-lg font-bold text-secondary leading-tight">
              {formatCurrency(totals.spend)}
            </div>
            <div className="text-xs text-muted mt-1">
              {totals.impressions.toLocaleString()} impressions
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase">
                Leads générés
              </span>
              <Target size={18} className="text-green-500" />
            </div>
            <div className="text-2xl font-bold text-secondary">
              {totals.leads}
            </div>
            <div className="text-xs text-muted mt-1">
              {totals.clicks.toLocaleString()} clics
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase">
                Coût par lead
              </span>
              <BarChart3
                size={18}
                className={clsx(
                  totals.cpl > 200 ? "text-red-500" : "text-green-500"
                )}
              />
            </div>
            <div
              className={clsx(
                "text-lg font-bold leading-tight",
                totals.cpl > 200 ? "text-red-600" : "text-green-600"
              )}
            >
              {totals.cpl > 0 ? formatCurrency(totals.cpl) : "—"}
            </div>
            <div className="text-xs text-muted mt-1">
              {totals.cpl > 200 ? (
                <span className="text-red-600">⚠️ Objectif: &lt; 200 AED (~50€)</span>
              ) : (
                <span className="text-green-600">✅ Dans l'objectif</span>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase">
                CTR moyen
              </span>
              <MousePointer size={18} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-secondary">
              {totals.ctr.toFixed(2)}%
            </div>
            <div className="text-xs text-muted mt-1">
              CPC moyen: {formatCurrency(totals.cpc)}
            </div>
          </div>
        </div>
      )}

      {/* Tableau campagnes */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full sm:min-w-[1200px]">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                >
                  Campagne
                  {sortField === "name" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                >
                  Statut
                  {sortField === "status" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.spend")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  Dépensé
                  {sortField === "insights.spend" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.impressions")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  Impressions
                  {sortField === "insights.impressions" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.clicks")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  Clics
                  {sortField === "insights.clicks" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.ctr")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  CTR
                  {sortField === "insights.ctr" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.cpc")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  CPC
                  {sortField === "insights.cpc" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.leads")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  Leads
                  {sortField === "insights.leads" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="opacity-40" />
                  )}
                </button>
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">
                <button
                  onClick={() => handleSort("insights.cost_per_lead")}
                  className="flex items-center gap-1 justify-end hover:text-secondary transition-colors w-full"
                >
                  Coût/Lead
                  {sortField === "insights.cost_per_lead" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
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
                <td
                  colSpan={9}
                  className="py-16 text-center text-muted"
                >
                  Chargement...
                </td>
              </tr>
            ) : sortedCampaigns.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="py-16 text-center text-muted"
                >
                  Aucune campagne trouvée
                </td>
              </tr>
            ) : (
              sortedCampaigns.map((campaign) => {
                const insights = campaign.insights;
                const cpl = insights?.cost_per_lead || 0;
                const status = campaign.status;

                return (
                  <tr
                    key={campaign.id}
                    className="border-b border-border/50 hover:bg-bg/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-secondary text-sm max-w-xs truncate">
                        {campaign.name}
                      </div>
                      <div className="text-xs text-muted">
                        {campaign.objective}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          status === "ACTIVE" &&
                            "bg-green-100 text-green-700",
                          status === "PAUSED" &&
                            "bg-yellow-100 text-yellow-700",
                          (status === "DELETED" || status === "ARCHIVED") &&
                            "bg-gray-100 text-gray-700"
                        )}
                      >
                        {status === "ACTIVE" && "Active"}
                        {status === "PAUSED" && "Pausée"}
                        {status === "DELETED" && "Supprimée"}
                        {status === "ARCHIVED" && "Archivée"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-semibold">
                      {insights ? (
                        <div className="flex flex-col items-end">
                          <span>{insights.spend.toFixed(2)} AED</span>
                          <span className="text-xs text-muted">
                            ({(insights.spend * AED_TO_EUR).toFixed(2)} €)
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted">
                      {insights
                        ? insights.impressions.toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted">
                      {insights ? insights.clicks.toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted">
                      {insights ? `${insights.ctr.toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted">
                      {insights ? (
                        <div className="flex flex-col items-end">
                          <span>{insights.cpc.toFixed(2)} AED</span>
                          <span className="text-xs text-muted">
                            ({(insights.cpc * AED_TO_EUR).toFixed(2)} €)
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-medium text-primary">
                      {insights?.leads || 0}
                    </td>
                    <td className="py-3 px-4 text-right text-sm font-bold">
                      {cpl > 0 ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={clsx(
                              cpl > 200 && "text-red-600",
                              cpl > 120 && cpl <= 200 && "text-orange-600",
                              cpl <= 120 && "text-green-600"
                            )}
                          >
                            {cpl.toFixed(2)} AED
                          </span>
                          <span className="text-xs text-muted">
                            ({(cpl * AED_TO_EUR).toFixed(2)} €)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-secondary mb-3">
          Légende des couleurs (Coût/Lead)
        </h3>
        <div className="flex items-center gap-6 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-muted">
              ≤ 120 AED (~30€) : <span className="font-medium text-secondary">Excellent</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-muted">
              121-200 AED (~30-50€) : <span className="font-medium text-secondary">Acceptable</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-muted">
              &gt; 200 AED (~50€) : <span className="font-medium text-secondary">À optimiser</span>
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted">
          Taux de conversion : <span className="font-semibold">1 AED ≈ 0.25 EUR</span> (1 EUR ≈ 4 AED)
        </div>
      </div>
    </div>
  );
}
