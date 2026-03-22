"use client";

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Users, Target, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";

interface CampaignROI {
  campaignId: string;
  campaignName: string;
  totalSpend: number; // AED
  totalSpendEUR: number;
  leadsCount: number;
  rdvCount: number;
  signaturesCount: number;
  totalRevenue: number; // EUR
  totalRevenueAED: number;
  roi: number; // %
  costPerLead: number; // AED
  costPerRDV: number; // AED
  costPerSignature: number; // AED
  conversionLeadToRDV: number; // %
  conversionRDVToSignature: number; // %
  conversionLeadToSignature: number; // %
}

interface ROISummary {
  totalSpend: number;
  totalSpendEUR: number;
  totalLeads: number;
  totalRDV: number;
  totalSignatures: number;
  totalRevenue: number;
  totalRevenueAED: number;
  averageROI: number;
  campaigns: CampaignROI[];
}

const AED_TO_EUR = 0.25;

export default function ROIContent() {
  const [data, setData] = useState<ROISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const fetchROI = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/facebook-ads/roi?period=${dateRange}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Erreur chargement ROI:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncRetroactive = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/facebook-ads/sync-retroactive", {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        alert(`✅ ${json.updated} clients associés rétroactivement`);
        fetchROI();
      }
    } catch (error) {
      console.error("Erreur sync rétroactive:", error);
      alert("❌ Erreur lors de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchROI();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Chargement des données ROI...</div>
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

  return (
    <div className="space-y-6">
      {/* Header avec filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-secondary">Retour sur Investissement (ROI)</h2>
          <p className="text-sm text-muted mt-1">
            Analyse complète des performances Facebook Ads par campagne
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncRetroactive}
            disabled={syncing}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Synchronisation..." : "Sync rétroactive"}
          </button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="flex-1 sm:flex-none px-3 py-2 border border-border rounded-lg bg-card text-secondary text-sm"
          >
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="all">Tout</option>
          </select>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dépenses totales */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Dépenses Pub</span>
            <DollarSign size={18} className="text-danger" />
          </div>
          <div className="text-2xl font-bold text-secondary">
            {data.totalSpend.toFixed(0)} AED
          </div>
          <div className="text-xs text-muted mt-1">
            {data.totalSpendEUR.toFixed(0)} €
          </div>
        </div>

        {/* Revenus totaux */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">CA Généré</span>
            <TrendingUp size={18} className="text-success" />
          </div>
          <div className="text-2xl font-bold text-secondary">
            {data.totalRevenue.toFixed(0)} €
          </div>
          <div className="text-xs text-muted mt-1">
            {data.totalRevenueAED.toFixed(0)} AED
          </div>
        </div>

        {/* ROI moyen */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">ROI Moyen</span>
            <Target size={18} className={data.averageROI > 0 ? "text-success" : "text-danger"} />
          </div>
          <div className={`text-2xl font-bold ${data.averageROI > 0 ? "text-success" : "text-danger"}`}>
            {data.averageROI > 0 ? "+" : ""}{data.averageROI.toFixed(0)}%
          </div>
          <div className="text-xs text-muted mt-1 flex items-center gap-1">
            {data.averageROI > 0 ? (
              <>
                <ArrowUp size={12} className="text-success" />
                Rentable
              </>
            ) : (
              <>
                <ArrowDown size={12} className="text-danger" />
                Non rentable
              </>
            )}
          </div>
        </div>

        {/* Conversions */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">Signatures</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-secondary">
            {data.totalSignatures}
          </div>
          <div className="text-xs text-muted mt-1">
            {data.totalLeads} leads → {data.totalRDV} RDV
          </div>
        </div>
      </div>

      {/* Tableau détaillé par campagne */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-secondary">Performance par Campagne</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-bg">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Campagne</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Dépenses</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">RDV</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Signatures</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">CA</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">ROI</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Coût/Sig</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    Aucune donnée ROI disponible. Cliquez sur "Sync rétroactive" pour associer les clients existants.
                  </td>
                </tr>
              ) : (
                data.campaigns.map((campaign) => (
                  <tr key={campaign.campaignId} className="hover:bg-bg transition-colors">
                    {/* Nom campagne */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-secondary">{campaign.campaignName}</div>
                      <div className="text-xs text-muted">ID: {campaign.campaignId}</div>
                    </td>

                    {/* Dépenses */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-secondary">{campaign.totalSpend.toFixed(0)} AED</div>
                      <div className="text-xs text-muted">{campaign.totalSpendEUR.toFixed(0)} €</div>
                    </td>

                    {/* Leads */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-secondary">{campaign.leadsCount}</div>
                      <div className="text-xs text-muted">{campaign.costPerLead.toFixed(0)} AED/lead</div>
                    </td>

                    {/* RDV */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-secondary">{campaign.rdvCount}</div>
                      <div className="text-xs text-muted">{campaign.costPerRDV.toFixed(0)} AED/RDV</div>
                    </td>

                    {/* Signatures */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-secondary">{campaign.signaturesCount}</div>
                      <div className="text-xs text-muted">
                        {campaign.costPerSignature > 0 ? `${campaign.costPerSignature.toFixed(0)} AED` : "—"}
                      </div>
                    </td>

                    {/* CA */}
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-secondary">{campaign.totalRevenue.toFixed(0)} €</div>
                      <div className="text-xs text-muted">{campaign.totalRevenueAED.toFixed(0)} AED</div>
                    </td>

                    {/* ROI */}
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`font-bold ${
                          campaign.roi > 100
                            ? "text-success"
                            : campaign.roi > 0
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {campaign.roi > 0 ? "+" : ""}
                        {campaign.roi.toFixed(0)}%
                      </div>
                    </td>

                    {/* Coût/Signature */}
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`font-medium ${
                          campaign.costPerSignature === 0
                            ? "text-muted"
                            : campaign.costPerSignature < 800 // ~200€
                            ? "text-success"
                            : campaign.costPerSignature < 1600 // ~400€
                            ? "text-warning"
                            : "text-danger"
                        }`}
                      >
                        {campaign.costPerSignature > 0 ? `${campaign.costPerSignature.toFixed(0)} AED` : "—"}
                      </div>
                      <div className="text-xs text-muted">
                        {campaign.costPerSignature > 0 ? `(${(campaign.costPerSignature * AED_TO_EUR).toFixed(0)} €)` : ""}
                      </div>
                    </td>

                    {/* Conversions */}
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs space-y-0.5">
                        <div className="text-muted">
                          L→RDV: <span className="text-secondary font-medium">{campaign.conversionLeadToRDV.toFixed(0)}%</span>
                        </div>
                        <div className="text-muted">
                          RDV→Sig: <span className="text-secondary font-medium">{campaign.conversionRDVToSignature.toFixed(0)}%</span>
                        </div>
                        <div className="text-muted">
                          L→Sig: <span className="text-secondary font-medium">{campaign.conversionLeadToSignature.toFixed(0)}%</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info sur sync rétroactive */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-primary mb-2">💡 Synchronisation rétroactive</h4>
        <p className="text-xs text-muted">
          La synchronisation rétroactive associe automatiquement les clients existants (avec RDV et signatures passées) aux campagnes Facebook en utilisant le champ "campaign". Cela permet de calculer le ROI historique complet, pas seulement pour les nouveaux leads.
        </p>
      </div>
    </div>
  );
}
