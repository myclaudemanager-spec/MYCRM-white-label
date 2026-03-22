/**
 * Facebook Marketing API Service
 *
 * Wrapper pour l'API Facebook Marketing avec gestion des erreurs,
 * pagination automatique et types TypeScript.
 *
 * @see https://developers.facebook.com/docs/marketing-api
 */

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || '';
const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID || '';
const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Types
 */
export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  created_time: string;
  updated_time: string;
}

export interface CampaignInsights {
  campaign_id: string;
  campaign_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  actions?: Action[];
  cost_per_action_type?: CostPerAction[];
}

export interface Action {
  action_type: string;
  value: string;
}

export interface CostPerAction {
  action_type: string;
  value: string;
}

export interface Lead {
  id: string;
  created_time: string;
  ad_id: string;
  ad_name?: string;
  adset_id: string;
  adset_name?: string;
  campaign_id: string;
  campaign_name?: string;
  form_id: string;
  field_data: Array<{ name: string; values: string[] }>;
}

export interface LeadForm {
  id: string;
  name: string;
  status: string;
  locale: string;
  questions: any[];
  leads_count?: number;
}

export interface DateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

/**
 * Classe principale du service Facebook Ads
 */
export class FacebookAdsService {
  private accessToken: string;
  private adAccountId: string;
  private pageId: string;

  constructor() {
    this.accessToken = FB_ACCESS_TOKEN;
    this.adAccountId = FB_AD_ACCOUNT_ID;
    this.pageId = FB_PAGE_ID;

    if (!this.accessToken || !this.adAccountId) {
      throw new Error('FB_ACCESS_TOKEN et FB_AD_ACCOUNT_ID doivent être définis dans .env');
    }
  }

  /**
   * Appel API générique avec gestion d'erreurs
   */
  private async apiCall<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryParams = new URLSearchParams({
      access_token: this.accessToken,
      ...params,
    });

    const url = `${BASE_URL}/${endpoint}?${queryParams}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error('Facebook API Error:', data.error);

        if (data.error.code === 190) {
          throw new Error('Token Facebook expiré. Génère un nouveau token.');
        }

        throw new Error(data.error.message || 'Erreur API Facebook');
      }

      return data;
    } catch (error: any) {
      console.error('Facebook API Call Error:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer toutes les données avec pagination automatique
   */
  private async getAllPaginated<T>(
    endpoint: string,
    params: Record<string, string> = {},
    maxPages: number = 10
  ): Promise<T[]> {
    const items: T[] = [];
    let nextUrl: string | null = null;
    let page = 1;

    do {
      const data: { data: T[]; paging?: { next?: string } } = nextUrl
        ? await fetch(nextUrl + `&access_token=${this.accessToken}`).then(r => r.json())
        : await this.apiCall<{ data: T[]; paging?: { next?: string } }>(endpoint, params);

      if (data.data) {
        items.push(...data.data);
      }

      nextUrl = data.paging?.next || null;
      page++;
    } while (nextUrl && page <= maxPages);

    return items;
  }

  /**
   * Récupérer toutes les campagnes
   */
  async getCampaigns(status?: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'): Promise<Campaign[]> {
    const params: Record<string, string> = {
      fields: 'id,name,status,objective,created_time,updated_time',
      limit: '100',
    };

    // ⚠️ Facebook API ne supporte plus le filtre 'status' (erreur #100)
    // On récupère toutes les campagnes et on filtre en JavaScript
    const allCampaigns = await this.getAllPaginated<Campaign>(`${this.adAccountId}/campaigns`, params);

    // Filtrer par statut si demandé
    if (status) {
      return allCampaigns.filter(campaign => campaign.status === status);
    }

    return allCampaigns;
  }

  /**
   * Récupérer les insights d'une campagne
   */
  async getCampaignInsights(
    campaignId: string,
    dateRange?: DateRange
  ): Promise<CampaignInsights | null> {
    const params: Record<string, string> = {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type',
      level: 'campaign',
    };

    if (dateRange) {
      params.time_range = JSON.stringify({ since: dateRange.since, until: dateRange.until });
    } else {
      params.date_preset = 'last_30d';
    }

    try {
      const data = await this.apiCall<{ data: CampaignInsights[] }>(`${campaignId}/insights`, params);
      return data.data?.[0] || null;
    } catch (error) {
      console.error(`Erreur insights campagne ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Récupérer les insights de toutes les campagnes
   */
  async getAllCampaignsInsights(dateRange?: DateRange): Promise<CampaignInsights[]> {
    const params: Record<string, string> = {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type',
      level: 'campaign',
      limit: '100',
    };

    if (dateRange) {
      params.time_range = JSON.stringify({ since: dateRange.since, until: dateRange.until });
    } else {
      params.date_preset = 'last_30d';
    }

    try {
      const data = await this.apiCall<{ data: CampaignInsights[] }>(
        `${this.adAccountId}/insights`,
        params
      );
      return data.data || [];
    } catch (error) {
      console.error('Erreur insights campagnes:', error);
      return [];
    }
  }

  /**
   * Récupérer tous les formulaires Lead Ads
   * Note: Les Lead Forms sont associés à une Page Facebook, pas à un Ad Account
   */
  async getLeadForms(): Promise<LeadForm[]> {
    if (!this.pageId) {
      console.warn('FB_PAGE_ID non défini - impossible de récupérer les Lead Forms');
      return [];
    }

    const params = {
      fields: 'id,name,status,locale,questions,leads_count',
      limit: '100',
    };

    try {
      return await this.getAllPaginated<LeadForm>(`${this.pageId}/leadgen_forms`, params);
    } catch (error: any) {
      // Si erreur d'accès aux Lead Forms (Page ID incorrect, permissions manquantes, etc.)
      // on retourne un tableau vide au lieu de crash
      console.error('Erreur récupération Lead Forms:', error.message);
      console.warn('⚠️  Vérifiez que FB_PAGE_ID est correct et que le token a les permissions "pages_read_engagement" et "pages_manage_ads"');
      return [];
    }
  }

  /**
   * Récupérer les leads d'un formulaire
   */
  async getLeadsFromForm(formId: string, since?: string): Promise<Lead[]> {
    const params: Record<string, string> = {
      fields: 'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data',
      limit: '100',
    };

    if (since) {
      params.filtering = JSON.stringify([
        { field: 'time_created', operator: 'GREATER_THAN', value: since },
      ]);
    }

    return this.getAllPaginated<Lead>(`${formId}/leads`, params);
  }

  /**
   * Récupérer tous les leads de tous les formulaires
   */
  async getAllLeads(since?: string): Promise<Lead[]> {
    const forms = await this.getLeadForms();
    const allLeads: Lead[] = [];

    for (const form of forms) {
      const leads = await this.getLeadsFromForm(form.id, since);
      allLeads.push(...leads);
    }

    return allLeads;
  }

  /**
   * Calculer le nombre de conversions (leads) depuis les insights
   */
  getLeadsCount(insights: CampaignInsights | null): number {
    if (!insights || !insights.actions) return 0;

    const leadAction = insights.actions.find(
      (a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    );

    return parseInt(leadAction?.value || '0');
  }

  /**
   * Calculer le coût par lead
   */
  getCostPerLead(insights: CampaignInsights | null): number {
    if (!insights) return 0;

    const leads = this.getLeadsCount(insights);
    if (leads === 0) return 0;

    return insights.spend / leads;
  }

  /**
   * Vérifier la validité du token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.apiCall('me', { fields: 'id,name' });
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Instance singleton du service
 */
export const fbAdsService = new FacebookAdsService();
