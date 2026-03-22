// Facebook Pixel integration for conversion tracking
// Events: Lead, RDV Pris, Signature, Installation, Paiement

// Déclaration Facebook Pixel sur window
declare global {
  interface Window {
    fbq?: (action: string, event: string, data?: Record<string, unknown>) => void;
  }
}

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

// Track standard events
export const pageview = () => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "PageView");
  }
};

// Track custom conversion events
export const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, data);
  }
};

// CRM-specific conversion events
export const pixelEvents = {
  // Quand un nouveau lead est créé
  newLead: (clientId: number, source?: string) => {
    trackEvent("Lead", {
      content_name: "Nouveau Lead",
      content_category: "CRM",
      client_id: clientId,
      source: source || "direct",
    });
  },

  // Quand un RDV est pris
  rdvPris: (clientId: number, rdvType?: string) => {
    trackEvent("Schedule", {
      content_name: "RDV Pris",
      content_category: "CRM",
      client_id: clientId,
      rdv_type: rdvType || "standard",
    });
  },

  // Quand une signature est faite
  signature: (clientId: number, amount?: number) => {
    trackEvent("Purchase", {
      content_name: "Signature",
      content_category: "CRM",
      client_id: clientId,
      value: amount || 0,
      currency: "AED", // Dubai = AED
    });
  },

  // Quand une installation est programmée
  installationProgrammee: (clientId: number) => {
    trackEvent("InitiateCheckout", {
      content_name: "Installation Programmée",
      content_category: "CRM",
      client_id: clientId,
    });
  },

  // Quand une installation est terminée
  installationTerminee: (clientId: number) => {
    trackEvent("CompleteRegistration", {
      content_name: "Installation Terminée",
      content_category: "CRM",
      client_id: clientId,
    });
  },

  // Quand le paiement est reçu
  paiement: (clientId: number, amount?: number) => {
    trackEvent("Purchase", {
      content_name: "Paiement Reçu",
      content_category: "CRM",
      client_id: clientId,
      value: amount || 0,
      currency: "AED", // Dubai = AED
    });
  },
};
