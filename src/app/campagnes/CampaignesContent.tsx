"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Facebook,
  Plus,
  TrendingUp,
  Send,
  Eye,
  MousePointer,
  UserPlus,
  BarChart3,
} from "lucide-react";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  leadsCount: number;
  createdAt: string;
}

export default function CampaignesContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"email" | "facebook">("email");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Erreur chargement campagnes:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return ((numerator / denominator) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">
            Campagnes Marketing
          </h1>
          <p className="text-sm text-muted mt-1">
            Gestion centralisée de toutes vos campagnes d'acquisition
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          onClick={() => alert("Fonctionnalité en développement")}
        >
          <Plus size={18} />
          Nouvelle campagne
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab("email")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === "email"
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted hover:text-secondary"
          }`}
        >
          <Mail size={18} />
          Campagnes Email
        </button>
        <button
          onClick={() => setTab("facebook")}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === "facebook"
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted hover:text-secondary"
          }`}
        >
          <Facebook size={18} />
          Facebook Ads
        </button>
      </div>

      {/* Email Tab */}
      {tab === "email" && (
        <div className="space-y-6">
          {/* Stats globales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Emails envoyés</span>
                <Send size={18} className="text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-secondary">
                {campaigns.reduce((sum, c) => sum + c.sentCount, 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Taux d'ouverture</span>
                <Eye size={18} className="text-green-500" />
              </div>
              <div className="text-2xl font-bold text-secondary">
                {calculateRate(
                  campaigns.reduce((sum, c) => sum + c.openedCount, 0),
                  campaigns.reduce((sum, c) => sum + c.sentCount, 0)
                )}
                %
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Taux de clic</span>
                <MousePointer size={18} className="text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-secondary">
                {calculateRate(
                  campaigns.reduce((sum, c) => sum + c.clickedCount, 0),
                  campaigns.reduce((sum, c) => sum + c.openedCount, 0)
                )}
                %
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted">Leads générés</span>
                <UserPlus size={18} className="text-primary" />
              </div>
              <div className="text-2xl font-bold text-secondary">
                {campaigns.reduce((sum, c) => sum + c.leadsCount, 0)}
              </div>
            </div>
          </div>

          {/* Liste campagnes */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-secondary">
                Toutes les campagnes email
              </h3>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted">
                Chargement...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-8 text-center">
                <BarChart3 size={48} className="mx-auto text-muted mb-3" />
                <p className="text-muted mb-4">
                  Aucune campagne email pour le moment
                </p>
                <button
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                  onClick={() => alert("Fonctionnalité en développement")}
                >
                  Créer votre première campagne
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                        Campagne
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                        Envoyés
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                        Ouvertures
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                        Clics
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                        Leads
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted">
                        Conv.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {campaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-bg transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-secondary">
                            {campaign.name}
                          </div>
                          <div className="text-xs text-muted">
                            {campaign.subject}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              campaign.status === "active"
                                ? "bg-green-100 text-green-700"
                                : campaign.status === "draft"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-secondary">
                          {campaign.sentCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-secondary">
                            {campaign.openedCount}
                          </div>
                          <div className="text-xs text-muted">
                            {calculateRate(campaign.openedCount, campaign.sentCount)}%
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-secondary">
                            {campaign.clickedCount}
                          </div>
                          <div className="text-xs text-muted">
                            {calculateRate(campaign.clickedCount, campaign.openedCount)}%
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {campaign.leadsCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-bold ${
                              Number(calculateRate(campaign.leadsCount, campaign.sentCount)) > 5
                                ? "text-green-600"
                                : Number(calculateRate(campaign.leadsCount, campaign.sentCount)) > 2
                                ? "text-orange-600"
                                : "text-red-600"
                            }`}
                          >
                            {calculateRate(campaign.leadsCount, campaign.sentCount)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              💡 Pour lancer une campagne email
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Importez votre base d'emails (CSV)</li>
              <li>L'agent Groq génère automatiquement des emails personnalisés</li>
              <li>Les emails sont envoyés via SMTP multi-comptes (3000/jour gratuit)</li>
              <li>Tracking automatique (ouvertures, clics, conversions)</li>
              <li>L'agent Haiku qualifie les leads et les insère dans le CRM</li>
            </ol>
          </div>
        </div>
      )}

      {/* Facebook Tab */}
      {tab === "facebook" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Facebook size={48} className="mx-auto text-muted mb-3" />
            <h3 className="text-lg font-semibold text-secondary mb-2">
              Facebook Lead Ads
            </h3>
            <p className="text-sm text-muted mb-4 max-w-md mx-auto">
              Intégration Facebook déjà configurée dans le CRM.<br />
              Consultez les pages analytics pour suivre vos performances en temps réel.
            </p>
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <a
                href="/analytics/ad-spend"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
              >
                💰 Dépenses Publicitaires
              </a>
              <a
                href="/analytics/facebook-live"
                className="px-4 py-2 border border-border rounded-lg hover:bg-bg transition-colors text-sm"
              >
                📊 Monitoring Live
              </a>
              <a
                href="/analytics/facebook-ads"
                className="px-4 py-2 border border-border rounded-lg hover:bg-bg transition-colors text-sm"
              >
                📘 Facebook Ads
              </a>
              <a
                href="/analytics/roi"
                className="px-4 py-2 border border-border rounded-lg hover:bg-bg transition-colors text-sm"
              >
                📈 ROI
              </a>
              <a
                href="/analytics/ad-spend/objectives"
                className="px-4 py-2 border border-border rounded-lg hover:bg-bg transition-colors text-sm"
              >
                🎯 Objectifs
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
