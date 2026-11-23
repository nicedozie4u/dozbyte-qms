'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function SetPasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== repeat) return setError('The new passwords do not match');
    try {
      await api.post('/auth/password', { currentPassword, newPassword });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cannot reach the server');
    }
  };

  return (
    <main className="narrow">
      <form className="panel stack" onSubmit={submit}>
        <h1>Set your own password</h1>
        <p className="muted">Use at least 10 characters. Nobody else, including us, can read it.</p>
        <div>
          <label htmlFor="current">Temporary password</label>
          <input
            id="current"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="new">New password</label>
          <input
            id="new"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="repeat">New password again</label>
          <input
            id="repeat"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-big">Save password</button>
      </form>
    </main>
  );
}
