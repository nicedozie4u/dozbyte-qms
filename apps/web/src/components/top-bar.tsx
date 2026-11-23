'use client';

import type { SessionUserView } from '@dozbyte/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function TopBar({
  user,
  title,
  live,
}: {
  user: SessionUserView;
  title: string;
  live?: boolean;
}) {
  const router = useRouter();
  const logout = async () => {
    await api.post('/auth/logout');
    router.replace('/login');
  };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="brand">
          Dozbyte
        </Link>
        <span className="topbar-title">{title}</span>
        {live !== undefined && (
          <span className={live ? 'live live-on' : 'live live-off'}>
            {live ? 'Live' : 'Reconnecting…'}
          </span>
        )}
      </div>
      <div className="topbar-right">
        <span className="muted">{user.name}</span>
        <button className="btn btn-quiet" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
