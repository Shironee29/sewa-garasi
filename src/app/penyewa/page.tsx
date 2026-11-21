import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PenyewaDashboardClient from './PenyewaDashboardClient';

export const instant = false;

export default async function PenyewaPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'ADMIN') {
    redirect('/admin');
  }

  return <PenyewaDashboardClient />;
}