/**
 * Page : Dépenses Publicitaires (Analytics)
 *
 * Dashboard centralisé pour toutes les dépenses publicitaires
 * - Facebook Ads (actuel)
 * - Google Ads (à venir)
 *
 * URL : /analytics/ad-spend
 */

import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdSpendDashboard from './AdSpendDashboard';
import AnalyticsTabs from "@/app/analytics/AnalyticsTabs";

export const metadata = {
  title: 'Dépenses Publicitaires | CRM',
  description: 'Dashboard centralisé des dépenses publicitaires Facebook Ads et Google Ads',
};

export default async function AdSpendPage() {
  // Vérifier authentification
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Réservé admin uniquement (pour l'instant)
  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Accès Refusé</h1>
          <p className="text-gray-600">
            Cette page est réservée aux administrateurs.
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour au Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (<><AnalyticsTabs /><AdSpendDashboard user={user} /></>);
}
