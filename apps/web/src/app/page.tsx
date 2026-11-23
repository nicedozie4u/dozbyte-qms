'use client';

import Link from 'next/link';
import { TopBar } from '@/components/top-bar';
import { useSession } from '@/lib/use-session';

export default function Home() {
  const user = useSession();
  if (!user) return null;
  return (
    <>
      <TopBar user={user} title="Home" />
      <main className="page">
        <div className="choice-grid">
          <Link href="/front-desk" className="panel btn choice">
            <h2>Front desk</h2>
            <span className="muted">Issue tickets and see who is waiting</span>
          </Link>
          <Link href="/console" className="panel btn choice">
            <h2>Staff console</h2>
            <span className="muted">Call next, serve and send on</span>
          </Link>
          {(user.role === 'branch_manager' || user.role === 'business_admin') && (
            <Link href="/settings" className="panel btn choice">
              <h2>Settings</h2>
              <span className="muted">Priority fairness and daily ticket limits</span>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
