import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');
  redirect('/analytics/overview');
}
