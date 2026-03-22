/**
 * Facebook Campaign Manager
 * Système de gestion automatisée des campagnes Facebook Ads
 */

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN!;
const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID!;
const FB_PAGE_ID = process.env.FB_PAGE_ID!;

export interface CampaignConfig {
  name: string;
  objective: 'OUTCOME_LEADS' | 'OUTCOME_SALES' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_AWARENESS';
  optimizationGoal?: 'LEAD_GENERATION' | 'CONVERSIONS' | 'LINK_CLICKS' | 'POST_ENGAGEMENT' | 'REACH' | 'IMPRESSIONS';
  bidStrategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP' | 'LOWEST_COST_WITH_MIN_ROAS';
  bidAmount?: number; // Pour COST_CAP ou BID_CAP
  minROAS?: number; // Pour LOWEST_COST_WITH_MIN_ROAS
  dailyBudgetAED: number;
  targeting: {
    countries: string[];
    ageMin: number;
    ageMax: number;
    customAudienceId?: string;
  };
  status: 'ACTIVE' | 'PAUSED';
}

export interface CampaignResult {
  campaignId: string;
  adSetId: string;
  name: string;
  status: string;
  dailyBudget: number;
  error?: string;
}

/**
 * Créer une campagne Facebook Ads complète
 */
export async function createCampaign(config: CampaignConfig): Promise<CampaignResult> {
  try {
    // 1. Créer la campagne
    const campaignResp = await fetch(
      `https://graph.facebook.com/v21.0/${FB_AD_ACCOUNT_ID}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          access_token: FB_ACCESS_TOKEN,
          name: config.name,
          objective: config.objective,
          status: config.status,
          special_ad_categories: JSON.stringify([]),
          is_adset_budget_sharing_enabled: 'false',
        }),
      }
    );

    const campaignData = await campaignResp.json();
    if (campaignData.error) {
      throw new Error(`Erreur création campagne: ${campaignData.error.message}`);
    }

    const campaignId = campaignData.id;

    // 2. Créer l'Ad Set
    const targeting: any = {
      geo_locations: {
        countries: config.targeting.countries,
      },
      age_min: config.targeting.ageMin,
      age_max: config.targeting.ageMax,
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed'],
      instagram_positions: ['stream'],
    };

    if (config.targeting.customAudienceId) {
      targeting.custom_audiences = [{ id: config.targeting.customAudienceId }];
    }

    // Paramètres Ad Set
    const adSetParams: Record<string, string> = {
      access_token: FB_ACCESS_TOKEN,
      name: `${config.name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: (config.dailyBudgetAED * 100).toString(), // Convertir en centimes
      billing_event: 'IMPRESSIONS',
      optimization_goal: config.optimizationGoal || 'LEAD_GENERATION',
      bid_strategy: config.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
      status: config.status,
      targeting: JSON.stringify(targeting),
      promoted_object: JSON.stringify({ page_id: FB_PAGE_ID }),
    };

    // Ajouter bid_amount si COST_CAP ou BID_CAP
    if ((config.bidStrategy === 'COST_CAP' || config.bidStrategy === 'LOWEST_COST_WITH_BID_CAP') && config.bidAmount) {
      adSetParams.bid_amount = (config.bidAmount * 100).toString(); // Centimes
    }

    // Ajouter min_roas si LOWEST_COST_WITH_MIN_ROAS
    if (config.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS' && config.minROAS) {
      adSetParams.min_roas = config.minROAS.toString();
    }

    const adSetResp = await fetch(
      `https://graph.facebook.com/v21.0/${FB_AD_ACCOUNT_ID}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(adSetParams),
      }
    );

    const adSetData = await adSetResp.json();
    if (adSetData.error) {
      throw new Error(`Erreur création ad set: ${adSetData.error.message}`);
    }

    return {
      campaignId,
      adSetId: adSetData.id,
      name: config.name,
      status: config.status,
      dailyBudget: config.dailyBudgetAED,
    };
  } catch (error: any) {
    return {
      campaignId: '',
      adSetId: '',
      name: config.name,
      status: 'ERROR',
      dailyBudget: config.dailyBudgetAED,
      error: error.message,
    };
  }
}

/**
 * Lister toutes les campagnes actives
 */
export async function listCampaigns() {
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${FB_AD_ACCOUNT_ID}/campaigns?access_token=${FB_ACCESS_TOKEN}&fields=id,name,status,daily_budget,objective,created_time`,
    { next: { revalidate: 60 } }
  );
  const data = await resp.json();
  return data.data || [];
}

/**
 * Obtenir les performances d'une campagne
 */
export async function getCampaignInsights(campaignId: string, days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const until = new Date().toISOString().split('T')[0];

  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${campaignId}/insights?access_token=${FB_ACCESS_TOKEN}&fields=spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type&time_range={"since":"${since}","until":"${until}"}`,
    { next: { revalidate: 300 } }
  );
  const data = await resp.json();
  return data.data?.[0] || null;
}

/**
 * Mettre à jour le statut d'une campagne
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED' | 'DELETED'
) {
  const resp = await fetch(`https://graph.facebook.com/v21.0/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: FB_ACCESS_TOKEN,
      status,
    }),
  });
  return await resp.json();
}

/**
 * Obtenir toutes les Custom Audiences
 */
export async function getCustomAudiences() {
  const resp = await fetch(
    `https://graph.facebook.com/v21.0/${FB_AD_ACCOUNT_ID}/customaudiences?access_token=${FB_ACCESS_TOKEN}&fields=id,name,approximate_count_lower_bound`,
    { next: { revalidate: 3600 } }
  );
  const data = await resp.json();
  return data.data || [];
}

/**
 * Templates de campagnes optimisées
 */
export const CAMPAIGN_TEMPLATES = {
  // ==================== LEAD GENERATION ====================

  leadgen_cold: {
    name: '[LEADGEN] Acquisition Cold - Propriétaires',
    objective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'LEAD_GENERATION' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 150,
    targeting: {
      countries: ['FR'],
      ageMin: 30,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  leadgen_lookalike: {
    name: '[LEADGEN] Lookalike 1% - Propriétaires',
    objective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'LEAD_GENERATION' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 150,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
      customAudienceId: '120241091957420388', // À remplacer par LAL réel
    },
    status: 'PAUSED' as const,
  },

  leadgen_retargeting: {
    name: '[LEADGEN] Retargeting Chaud - Visiteurs 30j',
    objective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'LEAD_GENERATION' as const,
    bidStrategy: 'COST_CAP' as const,
    bidAmount: 120, // CPL max 120 AED
    dailyBudgetAED: 70,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  leadgen_interest: {
    name: '[LEADGEN] Intérêts Propriétaires - Zones Cibles',
    objective: 'OUTCOME_LEADS' as const,
    optimizationGoal: 'LEAD_GENERATION' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 130,
    targeting: {
      countries: ['FR'],
      ageMin: 30,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  // ==================== CONVERSIONS (SALES) ====================

  sales_conversion: {
    name: '[SALES] Conversion - Leads Qualifiés',
    objective: 'OUTCOME_SALES' as const,
    optimizationGoal: 'CONVERSIONS' as const,
    bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS' as const,
    minROAS: 2.0, // ROI minimum 200%
    dailyBudgetAED: 200,
    targeting: {
      countries: ['FR'],
      ageMin: 30,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  sales_retargeting: {
    name: '[SALES] Retargeting Leads - Signature',
    objective: 'OUTCOME_SALES' as const,
    optimizationGoal: 'CONVERSIONS' as const,
    bidStrategy: 'COST_CAP' as const,
    bidAmount: 500, // Coût max par conversion 500 AED
    dailyBudgetAED: 150,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  // ==================== TRAFFIC ====================

  traffic_awareness: {
    name: '[TRAFFIC] Notoriété - Trafic Site',
    objective: 'OUTCOME_TRAFFIC' as const,
    optimizationGoal: 'LINK_CLICKS' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 80,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  // ==================== ENGAGEMENT ====================

  engagement_video: {
    name: '[ENGAGEMENT] Vidéo - Témoignages Clients',
    objective: 'OUTCOME_ENGAGEMENT' as const,
    optimizationGoal: 'POST_ENGAGEMENT' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 50,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },

  // ==================== AWARENESS ====================

  awareness_reach: {
    name: '[AWARENESS] Portée Maximale - Brand Awareness',
    objective: 'OUTCOME_AWARENESS' as const,
    optimizationGoal: 'REACH' as const,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
    dailyBudgetAED: 100,
    targeting: {
      countries: ['FR'],
      ageMin: 25,
      ageMax: 65,
    },
    status: 'PAUSED' as const,
  },
};

/**
 * Créer une campagne optimisée pré-configurée
 *
 * @param templateName Nom du template à utiliser
 * @param overrides Options pour surcharger le template
 */
export async function createCampaignFromTemplate(
  templateName: keyof typeof CAMPAIGN_TEMPLATES,
  overrides?: Partial<CampaignConfig>
): Promise<CampaignResult> {
  const template = CAMPAIGN_TEMPLATES[templateName];

  if (!template) {
    throw new Error(`Template "${templateName}" introuvable`);
  }

  // Fusionner template + overrides
  const config: CampaignConfig = {
    ...template,
    ...overrides,
  };

  return await createCampaign(config);
}

/**
 * Créer une campagne avec objectifs personnalisés
 *
 * @param templateName Nom du template de base
 * @param objectives Objectifs et alertes à configurer
 */
export async function createCampaignWithObjectives(
  templateName: keyof typeof CAMPAIGN_TEMPLATES,
  config: Partial<CampaignConfig>,
  objectives: {
    targetCPL?: number;
    targetMonthlyBudget?: number;
    targetLeadsPerDay?: number;
    alertIfCPLExceeds?: number;
    alertIfBudgetExceeds?: number;
    alertIfLeadsBelow?: number;
  }
): Promise<{ campaign: CampaignResult; objectiveId?: number }> {
  // 1. Créer campagne
  const campaign = await createCampaignFromTemplate(templateName, config);

  if (campaign.error) {
    return { campaign };
  }

  // 2. Créer objectif en DB (via API)
  try {
    const objectiveRes = await fetch(`/api/ad-spend/campaigns/${campaign.campaignId}/objectives`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        platform: 'facebook',
        campaignId: campaign.campaignId,
        campaignName: campaign.name,
        objective: config.objective || 'OUTCOME_LEADS',
        optimizationGoal: config.optimizationGoal || 'LEAD_GENERATION',
        ...objectives,
        isActive: true,
      }),
    });

    const objectiveData = await objectiveRes.json();

    if (objectiveData.success) {
      return {
        campaign,
        objectiveId: objectiveData.objective.id,
      };
    }
  } catch (err) {
    console.error('Erreur création objectif:', err);
  }

  return { campaign };
}

/**
 * DEPRECATED: Utiliser createCampaignFromTemplate() à la place
 *
 * @deprecated
 */
export async function createOptimizedCampaign(
  type: 'lookalike' | 'interest' | 'retargeting'
): Promise<CampaignResult> {
  const mapping: Record<string, keyof typeof CAMPAIGN_TEMPLATES> = {
    lookalike: 'leadgen_lookalike',
    interest: 'leadgen_interest',
    retargeting: 'leadgen_retargeting',
  };

  return await createCampaignFromTemplate(mapping[type]);
}
