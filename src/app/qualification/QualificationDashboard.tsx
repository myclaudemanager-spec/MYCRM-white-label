"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Target,
  Activity,
} from "lucide-react";

interface QualificationDashboardProps {
  userId: number;
  userRole: string;
}

interface Stats {
  overview: {
    totalProcessed: number;
    qualifiedCount: number;
    disqualifiedCount: number;
    qualificationRate: number;
    avgQualificationTime: number;
    avgQualificationTimeSeconds: number;
  };
  cpl: {
    cplQualifie: number;
    cplGlobal: number;
    economieParLead: number;
    economieMensuelle: number;
  };
  funnel: {
    newLeads: number;
    qualified: number;
    rdvPris: number;
    signe: number;
    conversionQualifiedToRDV: number;
    conversionRDVToSigne: number;
  };
  topDisqualificationReasons: Array<{
    reason: string;
    count: number;
    percentage: string;
  }>;
  teleposPerformance: Array<{
    teleposName: string;
    totalProcessed: number;
    qualified: number;
    disqualified: number;
    qualificationRate: string;
  }>;
  dailyEvolution: Array<{
    date: string;
    qualified: number;
    disqualified: number;
    total: number;
    rate: number;
  }>;
}

export default function QualificationDashboard({ userId, userRole }: QualificationDashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qualification/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erreur chargement stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Erreur lors du chargement des statistiques</p>
        </div>
      </div>
    );
  }

  const { overview, cpl, funnel, topDisqualificationReasons, teleposPerformance, dailyEvolution } = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            Dashboard Qualification
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Métriques de qualification des leads (7 derniers jours)
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Actualiser
        </button>
      </div>

      {/* KPIs Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taux de qualification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            {overview.qualificationRate >= 70 && (
              <span className="text-green-600 text-xs font-semibold">✓ Objectif</span>
            )}
            {overview.qualificationRate < 70 && (
              <span className="text-orange-600 text-xs font-semibold">⚠ Sous objectif</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {overview.qualificationRate}%
          </div>
          <div className="text-sm text-gray-500">Taux de qualification</div>
          <div className="text-xs text-gray-400 mt-2">
            {overview.qualifiedCount} qualifiés / {overview.totalProcessed} traités
          </div>
        </div>

        {/* Temps moyen */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            {overview.avgQualificationTimeSeconds < 10 && (
              <span className="text-green-600 text-xs font-semibold">✓ Rapide</span>
            )}
            {overview.avgQualificationTimeSeconds >= 10 && (
              <span className="text-orange-600 text-xs font-semibold">⚠ Lent</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {overview.avgQualificationTimeSeconds}s
          </div>
          <div className="text-sm text-gray-500">Temps moyen</div>
          <div className="text-xs text-gray-400 mt-2">
            Objectif : &lt; 10s
          </div>
        </div>

        {/* CPL Qualifié */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            {cpl.cplQualifie < 60 && (
              <span className="text-green-600 text-xs font-semibold">✓ Excellent</span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {cpl.cplQualifie} AED
          </div>
          <div className="text-sm text-gray-500">CPL Qualifié</div>
          <div className="text-xs text-gray-400 mt-2">
            ≈ {(cpl.cplQualifie * 0.25).toFixed(0)} EUR
          </div>
        </div>

        {/* Économie mensuelle */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-green-600 text-xs font-semibold">💰 Économie</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {cpl.economieMensuelle} AED
          </div>
          <div className="text-sm text-gray-500">Économie mensuelle</div>
          <div className="text-xs text-gray-400 mt-2">
            ≈ {(cpl.economieMensuelle * 0.25).toFixed(0)} EUR
          </div>
        </div>
      </div>

      {/* Funnel de conversion */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          Funnel de Conversion
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">{funnel.newLeads}</div>
            <div className="text-sm text-gray-600 font-medium">Nouveaux Leads</div>
            <div className="text-xs text-gray-400 mt-1">100%</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{funnel.qualified}</div>
            <div className="text-sm text-gray-600 font-medium">Qualifiés</div>
            <div className="text-xs text-gray-400 mt-1">
              {funnel.newLeads > 0 ? ((funnel.qualified / funnel.newLeads) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">{funnel.rdvPris}</div>
            <div className="text-sm text-gray-600 font-medium">RDV Pris</div>
            <div className="text-xs text-gray-400 mt-1">{funnel.conversionQualifiedToRDV}%</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">{funnel.signe}</div>
            <div className="text-sm text-gray-600 font-medium">Signés</div>
            <div className="text-xs text-gray-400 mt-1">{funnel.conversionRDVToSigne}%</div>
          </div>
        </div>
      </div>

      {/* Évolution quotidienne + Motifs disqualification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution quotidienne */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Évolution Quotidienne (7 jours)
          </h2>
          <div className="space-y-3">
            {dailyEvolution.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-20">
                  {new Date(day.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-green-500 h-full flex items-center justify-end pr-2 text-white text-xs font-semibold"
                        style={{ width: `${(day.qualified / (day.total || 1)) * 100}%` }}
                      >
                        {day.qualified > 0 && day.qualified}
                      </div>
                    </div>
                    <div className="w-12 text-right text-xs font-semibold text-gray-700">
                      {day.rate}%
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {day.qualified} qualifiés, {day.disqualified} rejetés
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top motifs disqualification */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            Top Motifs de Disqualification
          </h2>
          <div className="space-y-4">
            {topDisqualificationReasons.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                Aucune disqualification enregistrée
              </p>
            )}
            {topDisqualificationReasons.map((reason, index) => (
              <div key={reason.reason} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {reason.reason === "LOCATAIRE" && "🏠 Locataire"}
                      {reason.reason === "COPROPRIETE" && "🏢 Copropriété"}
                      {reason.reason === "HORS_ZONE" && "📍 Hors zone"}
                      {!["LOCATAIRE", "COPROPRIETE", "HORS_ZONE"].includes(reason.reason) && reason.reason}
                    </span>
                    <span className="text-sm font-semibold text-red-600">{reason.percentage}%</span>
                  </div>
                  <div className="bg-red-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{reason.count} leads rejetés</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Téléprospecteurs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Performance par Téléprospecteur (Top 5)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Nom</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Total Traités</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qualifiés</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Disqualifiés</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Taux</th>
              </tr>
            </thead>
            <tbody>
              {teleposPerformance.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-gray-500">
                    Aucune donnée disponible
                  </td>
                </tr>
              )}
              {teleposPerformance.map((tp) => (
                <tr key={tp.teleposName} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{tp.teleposName}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600">{tp.totalProcessed}</td>
                  <td className="py-3 px-4 text-center text-sm font-semibold text-green-600">
                    {tp.qualified}
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-semibold text-red-600">
                    {tp.disqualified}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        parseFloat(tp.qualificationRate) >= 70
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {tp.qualificationRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Informations importantes
        </h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>Taux de qualification ≥ 70%</strong> : Objectif atteint</li>
          <li>• <strong>Temps moyen &lt; 10s</strong> : Performance optimale</li>
          <li>• <strong>CPL</strong> : Coût par lead (AED) - Conversion 1 AED ≈ 0.25 EUR</li>
          <li>• <strong>Données</strong> : Derniers 7 jours glissants</li>
        </ul>
      </div>
    </div>
  );
}
