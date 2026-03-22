'use client';

/**
 * Composant : Gestionnaire d'Objectifs Campagnes
 *
 * Permet de définir et modifier les objectifs de chaque campagne
 */

import { useState, useEffect } from 'react';
import { formatDualCurrency } from '@/lib/currency-service';

// ==================== TYPES ====================

interface User {
  id: number;
  login: string;
  name: string;
  role: string;
}

interface Campaign {
  campaignId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendEUR: number;
  leads: number;
  cpl: number;
  status?: string;
}

interface Objective {
  id: number;
  platform: string;
  campaignId: string;
  campaignName: string;
  objective: string;
  optimizationGoal: string;
  targetDailyBudget: number | null;
  targetMonthlyBudget: number | null;
  targetCPL: number | null;
  targetLeadsPerDay: number | null;
  targetLeadsPerMonth: number | null;
  alertIfBudgetExceeds: number | null;
  alertIfCPLExceeds: number | null;
  alertIfLeadsBelow: number | null;
  isActive: boolean;
}

// ==================== COMPOSANT ====================

export default function ObjectivesManager({ user }: { user: User }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective>>({});
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [editingObjective, setEditingObjective] = useState<Partial<Objective> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger campagnes et objectifs
  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      setLoading(true);

      // Récupérer toutes les campagnes (30 derniers jours)
      const res = await fetch('/api/ad-spend/summary?period=last_30d');
      const data = await res.json();

      if (data.success) {
        setCampaigns(data.byCampaign);

        // Charger objectifs existants
        const objectivesMap: Record<string, Objective> = {};

        for (const campaign of data.byCampaign) {
          try {
            const objRes = await fetch(
              `/api/ad-spend/campaigns/${campaign.campaignId}/objectives?platform=${campaign.platform}`
            );

            if (objRes.ok) {
              const objData = await objRes.json();
              if (objData.success && objData.objective) {
                objectivesMap[campaign.campaignId] = objData.objective;
              }
            }
          } catch (err) {
            // Objectif n'existe pas encore
          }
        }

        setObjectives(objectivesMap);
      }
    } catch (err) {
      console.error('Erreur fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  // Ouvrir modal édition
  function openEdit(campaign: Campaign) {
    const existingObjective = objectives[campaign.campaignId];

    setSelectedCampaign(campaign.campaignId);
    setEditingObjective({
      platform: campaign.platform,
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      objective: existingObjective?.objective || 'OUTCOME_LEADS',
      optimizationGoal: existingObjective?.optimizationGoal || 'LEAD_GENERATION',
      targetDailyBudget: existingObjective?.targetDailyBudget || null,
      targetMonthlyBudget: existingObjective?.targetMonthlyBudget || null,
      targetCPL: existingObjective?.targetCPL || null,
      targetLeadsPerDay: existingObjective?.targetLeadsPerDay || null,
      targetLeadsPerMonth: existingObjective?.targetLeadsPerMonth || null,
      alertIfBudgetExceeds: existingObjective?.alertIfBudgetExceeds || 110,
      alertIfCPLExceeds: existingObjective?.alertIfCPLExceeds || null,
      alertIfLeadsBelow: existingObjective?.alertIfLeadsBelow || null,
      isActive: existingObjective?.isActive !== undefined ? existingObjective.isActive : true,
    });
  }

  // Fermer modal
  function closeEdit() {
    setSelectedCampaign(null);
    setEditingObjective(null);
  }

  // Sauvegarder objectif
  async function saveObjective() {
    if (!editingObjective || !selectedCampaign) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/ad-spend/campaigns/${selectedCampaign}/objectives`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingObjective),
      });

      const data = await res.json();

      if (data.success) {
        // Mettre à jour local
        setObjectives((prev) => ({
          ...prev,
          [selectedCampaign]: data.objective,
        }));

        alert('✅ Objectif sauvegardé avec succès');
        closeEdit();
      } else {
        alert('❌ Erreur: ' + data.error);
      }
    } catch (err: any) {
      console.error('Erreur save:', err);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // Calculer performance vs objectif
  function getPerformance(campaign: Campaign, objective?: Objective) {
    if (!objective) return null;

    const results: any = {};

    // CPL
    if (objective.targetCPL && campaign.cpl) {
      const performance = (objective.targetCPL / campaign.cpl) * 100;
      results.cpl = {
        target: objective.targetCPL,
        current: campaign.cpl,
        performance,
        status:
          performance >= 100
            ? 'on_track'
            : performance >= 80
            ? 'warning'
            : 'underperforming',
      };
    }

    return results;
  }

  // Rendu chargement
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des campagnes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📊 Gestion des Objectifs Campagnes
        </h1>
        <p className="text-gray-600">
          Définir les cibles et alertes pour chaque campagne
        </p>
      </div>

      {/* Liste Campagnes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-gray-700">
                  Campagne
                </th>
                <th className="text-right px-6 py-4 font-semibold text-gray-700">
                  CPL Actuel
                </th>
                <th className="text-right px-6 py-4 font-semibold text-gray-700">
                  CPL Cible
                </th>
                <th className="text-center px-6 py-4 font-semibold text-gray-700">
                  Performance
                </th>
                <th className="text-center px-6 py-4 font-semibold text-gray-700">
                  Objectif Configuré
                </th>
                <th className="text-center px-6 py-4 font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const objective = objectives[campaign.campaignId];
                const perf = getPerformance(campaign, objective);

                return (
                  <tr key={campaign.campaignId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {campaign.campaignName}
                      </p>
                      <p className="text-xs text-gray-500">{campaign.platform}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-semibold text-gray-900">
                        {campaign.cpl.toFixed(0)} AED
                      </p>
                      <p className="text-xs text-gray-500">
                        ({(campaign.cpl * 0.25).toFixed(0)} €)
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {objective?.targetCPL ? (
                        <>
                          <p className="font-semibold text-gray-900">
                            {objective.targetCPL} AED
                          </p>
                          <p className="text-xs text-gray-500">
                            ({(objective.targetCPL * 0.25).toFixed(0)} €)
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-400">Non défini</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {perf?.cpl ? (
                        <div>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              perf.cpl.status === 'on_track'
                                ? 'bg-green-100 text-green-800'
                                : perf.cpl.status === 'warning'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {perf.cpl.performance.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {objective ? (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          ✅ Configuré
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                          ❌ Non configuré
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => openEdit(campaign)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        {objective ? 'Modifier' : 'Configurer'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Édition */}
      {editingObjective && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Objectifs : {editingObjective.campaignName}
              </h2>

              <div className="space-y-6">
                {/* Objectif Campaign */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Objectif Campagne
                  </label>
                  <select
                    value={editingObjective.objective}
                    onChange={(e) =>
                      setEditingObjective((prev) => ({
                        ...prev,
                        objective: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="OUTCOME_LEADS">OUTCOME_LEADS (Génération leads)</option>
                    <option value="OUTCOME_SALES">OUTCOME_SALES (Ventes)</option>
                    <option value="OUTCOME_TRAFFIC">OUTCOME_TRAFFIC (Trafic)</option>
                  </select>
                </div>

                {/* Cibles */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Cibles</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        CPL Cible (AED)
                      </label>
                      <input
                        type="number"
                        value={editingObjective.targetCPL || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            targetCPL: e.target.value ? parseFloat(e.target.value) : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="120"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Leads/jour cible
                      </label>
                      <input
                        type="number"
                        value={editingObjective.targetLeadsPerDay || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            targetLeadsPerDay: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Budget jour cible (AED)
                      </label>
                      <input
                        type="number"
                        value={editingObjective.targetDailyBudget || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            targetDailyBudget: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="1200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Budget mois cible (AED)
                      </label>
                      <input
                        type="number"
                        value={editingObjective.targetMonthlyBudget || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            targetMonthlyBudget: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="36000"
                      />
                    </div>
                  </div>
                </div>

                {/* Alertes */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Alertes</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Alerte si CPL dépasse (AED)
                      </label>
                      <input
                        type="number"
                        value={editingObjective.alertIfCPLExceeds || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            alertIfCPLExceeds: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="150"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Alerte si leads/jour en dessous de
                      </label>
                      <input
                        type="number"
                        value={editingObjective.alertIfLeadsBelow || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            alertIfLeadsBelow: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Alerte si budget dépasse (%)
                      </label>
                      <input
                        type="number"
                        value={editingObjective.alertIfBudgetExceeds || ''}
                        onChange={(e) =>
                          setEditingObjective((prev) => ({
                            ...prev,
                            alertIfBudgetExceeds: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="110"
                      />
                    </div>
                  </div>
                </div>

                {/* Actif */}
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingObjective.isActive}
                      onChange={(e) =>
                        setEditingObjective((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Objectif actif (générer des alertes)
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={closeEdit}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  onClick={saveObjective}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
