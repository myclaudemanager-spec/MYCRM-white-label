"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  RefreshCw,
  Clock,
  Phone,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";

interface CampaignStats {
  campaignId: string;
  campaignName: string;
  spendToday: number; // AED
  leadsToday: number;
  cplToday: number; // AED
  status: "ACTIVE" | "PAUSED";
}

interface RecentLead {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  createdAt: string;
  campaign: string;
}

interface HourlyData {
  hour: string;
  spend: number;
  leads: number;
  cpl: number;
}

interface LiveStats {
  // KPIs du jour
  totalSpendToday: number; // AED
  totalLeadsToday: number;
  avgCPLToday: number; // AED

  // Comparaison avec hier
  spendYesterday: number;
  leadsYesterday: number;
  cplYesterday: number;

  // Données par campagne
  campaigns: CampaignStats[];

  // Évolution horaire
  hourlyData: HourlyData[];

  // 10 derniers leads
  recentLeads: RecentLead[];

  // Dernière mise à jour
  lastUpdate: string;
}

const AED_TO_EUR = 0.25;

export default function DashboardContent() {
  const [data, setData] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const fetchLiveStats = async () => {
    try {
      const res = await fetch("/api/facebook/live-stats");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setCountdown(30); // Reset countdown
      }
    } catch (error) {
      console.error("Erreur chargement stats live:", error);
    } finally {
      setLoading(false);
    }
  };

  // Premier chargement
  useEffect(() => {
    fetchLiveStats();
  }, []);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLiveStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Countdown
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Chargement des données en temps réel...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger">Erreur de chargement des données</div>
      </div>
    );
  }

  // Calculer les variations vs hier
  const spendVariation = data.spendYesterday > 0
    ? ((data.totalSpendToday - data.spendYesterday) / data.spendYesterday) * 100
    : 0;
  const leadsVariation = data.leadsYesterday > 0
    ? ((data.totalLeadsToday - data.leadsYesterday) / data.leadsYesterday) * 100
    : 0;
  const cplVariation = data.cplYesterday > 0
    ? ((data.avgCPLToday - data.cplYesterday) / data.cplYesterday) * 100
    : 0;

  // Badge de couleur selon CPL
  const getCPLBadge = (cpl: number) => {
    if (cpl === 0) return { color: "text-muted", label: "N/A", icon: AlertCircle };
    if (cpl < 60) return { color: "text-success", label: "Excellent", icon: CheckCircle };
    if (cpl < 80) return { color: "text-warning", label: "Correct", icon: AlertTriangle };
    return { color: "text-danger", label: "Élevé", icon: AlertCircle };
  };

  const avgBadge = getCPLBadge(data.avgCPLToday);
  const AvgBadgeIcon = avgBadge.icon;

  return (
    <div className="space-y-6">
      {/* Header avec contrôles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-secondary">
            Monitoring Facebook Lead Ads - Temps Réel
          </h2>
          <p className="text-sm text-muted mt-1">
            Mise à jour automatique toutes les 30 secondes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={16} />
            <span>
              {autoRefresh ? `Prochain refresh : ${countdown}s` : "Auto-refresh désactivé"}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm ${
              autoRefresh
                ? "bg-primary text-white hover:bg-primary-dark"
                : "bg-border text-muted hover:bg-border-dark"
            }`}
          >
            {autoRefresh ? "Pause" : "Reprendre"}
          </button>
          <button
            onClick={fetchLiveStats}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPIs du jour avec comparaison hier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dépenses aujourd'hui */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Dépenses Aujourd&apos;hui</span>
            <DollarSign size={18} className="text-danger" />
          </div>
          <div className="text-2xl font-bold text-secondary">
            {data.totalSpendToday.toFixed(0)} AED
          </div>
          <div className="text-xs text-muted mt-1">
            {(data.totalSpendToday * AED_TO_EUR).toFixed(0)} €
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-muted">Hier:</span>
            <span className="text-secondary">{data.spendYesterday.toFixed(0)} AED</span>
            <span className={spendVariation >= 0 ? "text-danger" : "text-success"}>
              ({spendVariation >= 0 ? "+" : ""}{spendVariation.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Leads aujourd'hui */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Leads Aujourd&apos;hui</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-secondary">
            {data.totalLeadsToday}
          </div>
          <div className="text-xs text-muted mt-1">
            Nouveaux prospects reçus
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-muted">Hier:</span>
            <span className="text-secondary">{data.leadsYesterday}</span>
            <span className={leadsVariation >= 0 ? "text-success" : "text-danger"}>
              ({leadsVariation >= 0 ? "+" : ""}{leadsVariation.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* CPL moyen */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">CPL Moyen Aujourd&apos;hui</span>
            <Target size={18} className={avgBadge.color} />
          </div>
          <div className={`text-2xl font-bold ${avgBadge.color}`}>
            {data.avgCPLToday > 0 ? `${data.avgCPLToday.toFixed(0)} AED` : "—"}
          </div>
          <div className="text-xs text-muted mt-1 flex items-center gap-1">
            <AvgBadgeIcon size={12} className={avgBadge.color} />
            {avgBadge.label}
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-muted">Hier:</span>
            <span className="text-secondary">
              {data.cplYesterday > 0 ? `${data.cplYesterday.toFixed(0)} AED` : "—"}
            </span>
            {data.cplYesterday > 0 && (
              <span className={cplVariation <= 0 ? "text-success" : "text-danger"}>
                ({cplVariation >= 0 ? "+" : ""}{cplVariation.toFixed(0)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Performance par campagne avec alertes CPL */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-secondary">
            Performance par Campagne (Aujourd&apos;hui)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-bg">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Campagne</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Dépenses</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">CPL</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted">Alerte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Aucune campagne active aujourd&apos;hui
                  </td>
                </tr>
              ) : (
                data.campaigns.map((campaign) => {
                  const badge = getCPLBadge(campaign.cplToday);
                  const BadgeIcon = badge.icon;

                  return (
                    <tr key={campaign.campaignId} className="hover:bg-bg transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-secondary">{campaign.campaignName}</div>
                        <div className="text-xs text-muted">ID: {campaign.campaignId}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            campaign.status === "ACTIVE"
                              ? "bg-success/10 text-success"
                              : "bg-muted/10 text-muted"
                          }`}
                        >
                          {campaign.status === "ACTIVE" ? "Active" : "En pause"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-secondary">
                          {campaign.spendToday.toFixed(0)} AED
                        </div>
                        <div className="text-xs text-muted">
                          {(campaign.spendToday * AED_TO_EUR).toFixed(0)} €
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-secondary">{campaign.leadsToday}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-bold ${badge.color}`}>
                          {campaign.cplToday > 0 ? `${campaign.cplToday.toFixed(0)} AED` : "—"}
                        </div>
                        {campaign.cplToday > 0 && (
                          <div className="text-xs text-muted">
                            {(campaign.cplToday * AED_TO_EUR).toFixed(0)} €
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <BadgeIcon size={16} className={badge.color} />
                          <span className={`text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Graphiques évolution horaire */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dépenses par heure */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-secondary mb-4">
            Dépenses par heure (AED)
          </h3>
          <div className="space-y-2">
            {data.hourlyData.length === 0 ? (
              <div className="text-center text-muted py-8">Aucune donnée horaire</div>
            ) : (
              data.hourlyData.map((hour) => (
                <div key={hour.hour} className="flex items-center gap-3">
                  <div className="text-xs text-muted w-12">{hour.hour}h</div>
                  <div className="flex-1">
                    <div className="h-6 bg-bg rounded overflow-hidden">
                      <div
                        className="h-full bg-danger transition-all"
                        style={{
                          width: `${Math.min((hour.spend / Math.max(...data.hourlyData.map(h => h.spend))) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-xs font-medium text-secondary w-16 text-right">
                    {hour.spend.toFixed(0)} AED
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leads par heure */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-secondary mb-4">
            Leads reçus par heure
          </h3>
          <div className="space-y-2">
            {data.hourlyData.length === 0 ? (
              <div className="text-center text-muted py-8">Aucune donnée horaire</div>
            ) : (
              data.hourlyData.map((hour) => (
                <div key={hour.hour} className="flex items-center gap-3">
                  <div className="text-xs text-muted w-12">{hour.hour}h</div>
                  <div className="flex-1">
                    <div className="h-6 bg-bg rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${Math.min((hour.leads / Math.max(...data.hourlyData.map(h => h.leads))) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-xs font-medium text-secondary w-16 text-right">
                    {hour.leads}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 10 derniers leads reçus */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-secondary">
            10 Derniers Leads Reçus Aujourd&apos;hui
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-bg">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Heure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Téléphone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Campagne</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Aucun lead reçu aujourd&apos;hui
                  </td>
                </tr>
              ) : (
                data.recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-bg transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted">
                        {new Date(lead.createdAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-secondary">
                        {lead.firstName} {lead.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-secondary">
                        <Phone size={14} className="text-muted" />
                        {lead.mobile}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted">{lead.campaign || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/clients?id=${lead.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:text-primary-dark transition-colors text-xs"
                      >
                        Voir fiche
                        <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <TrendingUp size={18} className="text-primary mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-primary mb-1">
              Alertes CPL (Coût Par Lead)
            </h4>
            <div className="text-xs text-muted space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-success" />
                <span>
                  <strong className="text-success">Vert (Excellent)</strong> : CPL &lt; 60 AED
                  (≈15 €)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-warning" />
                <span>
                  <strong className="text-warning">Orange (Correct)</strong> : CPL 60-80 AED (15-20
                  €)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle size={12} className="text-danger" />
                <span>
                  <strong className="text-danger">Rouge (Élevé)</strong> : CPL &gt; 80 AED (&gt;20
                  €)
                </span>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Dernière mise à jour : {new Date(data.lastUpdate).toLocaleString("fr-FR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
