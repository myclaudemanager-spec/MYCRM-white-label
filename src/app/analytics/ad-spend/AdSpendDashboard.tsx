'use client';

/**
 * Composant : Dashboard Dépenses Publicitaires
 *
 * Dashboard centralisé avec dual-currency (AED + EUR)
 */

import { useState, useEffect } from 'react';
import { formatDualCurrency, formatCurrency, CurrencyFormatter } from '@/lib/currency-service';

// ==================== TYPES ====================

interface User {
  id: number;
  login: string;
  name: string;
  role: string;
}

interface Alert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  campaignId: string;
  campaignName: string;
  platform: string;
  message: string;
  currentValue: number;
  targetValue: number;
  date: string;
}

interface Campaign {
  campaignId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendEUR: number;
  leads: number;
  clicks: number;
  impressions: number;
  cpl: number;
  cpc: number;
  objective?: string;
  status?: string;
}

interface Summary {
  totalSpend: number;
  totalSpendEUR: number;
  currency: string;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  avgCPL: number;
  avgCPC: number;
  avgCTR: number;
}

interface Evolution {
  date: string;
  spend: number;
  spendEUR: number;
  leads: number;
  clicks: number;
  impressions: number;
}

// ==================== COMPOSANT ====================

export default function AdSpendDashboard({ user }: { user: User }) {
  // État
  const [platform, setPlatform] = useState<'all' | 'facebook' | 'google'>('all');
  const [period, setPeriod] = useState<string>('last_30d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byPlatform, setByPlatform] = useState<Record<string, any>>({});
  const [byCampaign, setByCampaign] = useState<Campaign[]>([]);
  const [evolution, setEvolution] = useState<Evolution[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger données
  useEffect(() => {
    fetchData();
    fetchAlerts();
  }, [platform, period]);

  // Récupérer résumé
  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const url = `/api/ad-spend/summary?platform=${platform}&period=${period}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Erreur récupération dépenses');
      }

      const data = await res.json();

      if (data.success) {
        setSummary(data.summary);
        setByPlatform(data.byPlatform);
        setByCampaign(data.byCampaign);
        setEvolution(data.evolution);
      } else {
        setError(data.error || 'Erreur inconnue');
      }
    } catch (err: any) {
      console.error('Erreur fetch data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Récupérer alertes
  async function fetchAlerts() {
    try {
      const url = `/api/ad-spend/alerts?platform=${platform}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAlerts(data.alerts);
        }
      }
    } catch (err) {
      console.error('Erreur fetch alerts:', err);
    }
  }

  // Helpers
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCPLBadge = (cpl: number) => {
    if (cpl < 60) {
      return { text: 'Excellent', color: 'bg-green-100 text-green-800' };
    }
    if (cpl >= 60 && cpl <= 80) {
      return { text: 'Correct', color: 'bg-orange-100 text-orange-800' };
    }
    return { text: 'Élevé', color: 'bg-red-100 text-red-800' };
  };

  // Rendu chargement
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des dépenses...</p>
          </div>
        </div>
      </div>
    );
  }

  // Rendu erreur
  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-red-800 font-semibold">Erreur</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🎯 Dépenses Publicitaires
        </h1>
        <p className="text-gray-600">
          Dashboard centralisé Facebook Ads + Google Ads (à venir)
        </p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Filtre Plateforme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plateforme
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes les plateformes</option>
              <option value="facebook">Facebook Ads uniquement</option>
              <option value="google">Google Ads uniquement</option>
            </select>
          </div>

          {/* Filtre Période */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="last_7d">7 derniers jours</option>
              <option value="last_30d">30 derniers jours</option>
              <option value="this_month">Ce mois-ci</option>
              <option value="last_month">Mois dernier</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* KPIs Principaux */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Dépensé */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Dépensé</p>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalSpend.toFixed(0)} AED
            </p>
            <p className="text-sm text-gray-500">
              ({summary.totalSpendEUR.toFixed(0)} €)
            </p>
          </div>

          {/* Leads Générés */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Leads Générés</p>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.totalLeads}</p>
            <p className="text-sm text-gray-500">
              {summary.totalClicks} clics ({summary.avgCTR.toFixed(2)}% CTR)
            </p>
          </div>

          {/* CPL Moyen */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">CPL Moyen</p>
              <span className="text-2xl">🎯</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summary.avgCPL.toFixed(0)} AED
            </p>
            <p className="text-sm text-gray-500">
              ({(summary.avgCPL * 0.25).toFixed(0)} €)
            </p>
          </div>
        </div>
      )}

      {/* Par Plateforme */}
      {Object.keys(byPlatform).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Par Plateforme</h2>
          <div className="space-y-4">
            {Object.entries(byPlatform).map(([platformName, data]: [string, any]) => (
              <div key={platformName} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {platformName === 'facebook' ? '📘 Facebook Ads' : '🔍 Google Ads'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {data.spend.toFixed(0)} AED ({data.spendEUR.toFixed(0)} €)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{data.leads} leads</p>
                    <p className="text-sm font-semibold text-gray-900">
                      CPL: {data.cpl.toFixed(0)} AED
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphique Évolution */}
      {evolution.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Évolution</h2>
          <div className="space-y-2">
            {evolution.map((ev, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-xs text-gray-600 w-20">
                  {new Date(ev.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="bg-red-500 h-6 rounded"
                      style={{
                        width: `${Math.min((ev.spend / Math.max(...evolution.map((e) => e.spend))) * 100, 100)}%`,
                      }}
                    ></div>
                    <span className="text-xs text-gray-600">
                      {ev.spend.toFixed(0)} AED
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="bg-blue-500 h-4 rounded"
                      style={{
                        width: `${Math.min((ev.leads / Math.max(...evolution.map((e) => e.leads))) * 100, 100)}%`,
                      }}
                    ></div>
                    <span className="text-xs text-gray-600">{ev.leads} leads</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau Campagnes */}
      {byCampaign.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Par Campagne</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">
                    Campagne
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">
                    Dépenses (AED)
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">
                    Dépenses (EUR)
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">
                    Leads
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">
                    CPL (AED)
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byCampaign.map((campaign) => {
                  const badge = getCPLBadge(campaign.cpl);
                  return (
                    <tr key={campaign.campaignId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {campaign.campaignName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {campaign.status || 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {campaign.spend.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {campaign.spendEUR.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {campaign.leads}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {campaign.cpl.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}
                        >
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔔 Alertes Actives</h2>
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">{alert.campaignName}</p>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs mt-1 opacity-75">
                      {new Date(alert.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase">
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message vide */}
      {!summary && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600 text-lg mb-2">Aucune donnée disponible</p>
          <p className="text-gray-500 text-sm">
            Lancez la synchronisation quotidienne ou vérifiez la période sélectionnée
          </p>
        </div>
      )}
    </div>
  );
}
