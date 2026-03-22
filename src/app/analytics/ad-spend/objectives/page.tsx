/**
 * Page : Gestion des Objectifs Campagnes
 *
 * Permet de définir et suivre les objectifs de chaque campagne
 * - Objectifs de performance (CPL, leads/jour, budget)
 * - Alertes automatiques
 * - Suivi performance vs objectif
 *
 * URL : /analytics/ad-spend/objectives
 */

import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ObjectivesManager from './ObjectivesManager';

export const metadata = {
  title: 'Objectifs Campagnes | CRM',
  description: 'Gestion des objectifs et alertes des campagnes publicitaires',
};

export default async function ObjectivesPage() {
  // Vérifier authentification
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Réservé admin uniquement
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

  return <ObjectivesManager user={user} />;
}
