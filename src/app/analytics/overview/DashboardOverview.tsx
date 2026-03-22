"use client";

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface PlatformStats {
  spendAed: number;
  spendEur: number;
  leads: number;
  leadsCrm?: number;
  leadsApi?: number;
  cplAed: number;
  cplEur: number;
  campaigns?: number;
  period?: string;
  note?: string;
}

interface TodayStats {
  facebook: PlatformStats;
  google: PlatformStats;
  totalLeads: number;
  totalSpendAed: number;
}

interface CombinedStats {
  date: string;
  lastUpdate: string;
  today: TodayStats;
  facebook: PlatformStats;
  google: PlatformStats;
  total: PlatformStats;
}

export default function DashboardOverview() {
  const [data, setData] = useState<CombinedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/analytics/combined-stats');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setCountdown(30);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStats, 30000);
    const cd = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => { clearInterval(interval); clearInterval(cd); };
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Erreur de chargement
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vue d&apos;Ensemble Ads</h2>
          <p className="text-sm text-gray-500">
            {new Date(data.date + 'T00:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto ({countdown}s)
          </label>
          <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* TODAY */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Aujourd&apos;hui</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Spend Facebook" value={`${fmt(data.today.facebook.spendAed)} AED`} sub={`${fmt(data.today.facebook.spendEur)} EUR`} />
          <MiniStat label="Leads Facebook" value={String(data.today.facebook.leads)} sub={`${data.today.facebook.leadsApi || 0} via API FB`} />
          <MiniStat label="Leads Google" value={String(data.today.google.leads)} sub="Landing page" />
          <MiniStat label="CPL Facebook" value={data.today.facebook.cplAed > 0 ? `${fmt(data.today.facebook.cplAed)} AED` : '---'} sub={data.today.facebook.cplEur > 0 ? `${fmt(data.today.facebook.cplEur)} EUR` : ''} />
        </div>
      </div>

      {/* LIFETIME */}
      <h3 className="text-lg font-semibold text-gray-700">Totaux depuis le lancement</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Facebook Ads" color="blue" stats={data.facebook} fmt={fmtInt} />
        <Card title="Google Ads" color="green" stats={data.google} fmt={fmtInt} />
        <Card title="TOTAL" color="purple" stats={data.total} isTotal fmt={fmtInt} />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold">D&eacute;tails par Plateforme (Lifetime)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plateforme</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">D&eacute;penses (AED)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">D&eacute;penses (EUR)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Leads</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Leads CRM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPL (AED)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&eacute;riode</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <TableRow platform="Facebook Ads" stats={data.facebook} />
              <TableRow platform="Google Ads" stats={data.google} />
              <TableRow platform="TOTAL" stats={data.total} isTotal />
            </tbody>
          </table>
        </div>
      </div>

      {data.google.note && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          <strong>Google Ads :</strong> {data.google.note}
        </div>
      )}

      <div className="text-center text-sm text-gray-500">
        Mise &agrave; jour : {new Date(data.lastUpdate).toLocaleTimeString('fr-FR')}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, color, stats, isTotal = false, fmt }: {
  title: string; color: 'blue' | 'green' | 'purple'; stats: PlatformStats; isTotal?: boolean; fmt: (n: number) => string;
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colors[color]} ${isTotal ? 'ring-2 ring-purple-300' : ''}`}>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {stats.period && <p className="text-xs opacity-60 mb-4">{stats.period}</p>}
      <div className="space-y-4">
        <div>
          <div className="text-sm opacity-75 mb-1">D&eacute;penses</div>
          <div className="text-2xl font-bold">{fmt(stats.spendAed)} AED</div>
          <div className="text-sm opacity-75">{fmt(stats.spendEur)} EUR</div>
        </div>
        <div>
          <div className="text-sm opacity-75 mb-1">Leads</div>
          <div className="text-2xl font-bold">{stats.leads}</div>
          {stats.leadsCrm !== undefined && stats.leadsCrm !== stats.leads && (
            <div className="text-xs opacity-60">{stats.leadsCrm} qualifi&eacute;s dans le CRM</div>
          )}
        </div>
        <div>
          <div className="text-sm opacity-75 mb-1">CPL</div>
          <div className="text-xl font-bold">{stats.cplAed > 0 ? `${fmt(stats.cplAed)} AED` : '---'}</div>
          <div className="text-sm opacity-75">{stats.cplEur > 0 ? `${fmt(stats.cplEur)} EUR` : '---'}</div>
        </div>
        {stats.campaigns !== undefined && (
          <div className="pt-4 border-t border-current opacity-50">
            <div className="text-sm">{stats.campaigns} campagne(s)</div>
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({ platform, stats, isTotal = false }: {
  platform: string; stats: PlatformStats; isTotal?: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <tr className={isTotal ? 'bg-purple-50 font-bold' : ''}>
      <td className="px-6 py-4 text-sm font-medium">{platform}</td>
      <td className="px-6 py-4 text-sm text-right">{fmt(stats.spendAed)} AED</td>
      <td className="px-6 py-4 text-sm text-right">{fmt(stats.spendEur)} EUR</td>
      <td className="px-6 py-4 text-sm text-right font-semibold">{stats.leads}</td>
      <td className="px-6 py-4 text-sm text-right">{stats.leadsCrm ?? '---'}</td>
      <td className="px-6 py-4 text-sm text-right">{stats.cplAed > 0 ? `${fmt(stats.cplAed)} AED` : '---'}</td>
      <td className="px-6 py-4 text-sm text-right text-gray-400">{stats.period || ''}</td>
    </tr>
  );
}
