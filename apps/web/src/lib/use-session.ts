'use client';

import type { SessionUserView } from '@dozbyte/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

/** Loads the signed-in user; sends them to log in or set a password when needed. */
export function useSession(): SessionUserView | null {
  const router = useRouter();
  const [user, setUser] = useState<SessionUserView | null>(null);

  useEffect(() => {
    api
      .get<{ user: SessionUserView }>('/auth/me')
      .then(({ user }) => {
        if (user.mustSetPassword) router.replace('/set-password');
        else setUser(user);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login');
      });
  }, [router]);

  return user;
}
