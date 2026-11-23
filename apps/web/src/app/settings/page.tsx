'use client';

import type { BranchSetupView } from '@dozbyte/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { TopBar } from '@/components/top-bar';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/use-session';

/** Branch settings for managers and admins: fairness rule and daily ticket limits (FR-14). */
export default function SettingsPage() {
  const user = useSession();
  const [setup, setSetup] = useState<BranchSetupView | null>(null);
  const [fairness, setFairness] = useState('');
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (s: BranchSetupView) => {
    setSetup(s);
    setFairness(s.branch.normalAfterPriority?.toString() ?? '');
    setLimits(
      Object.fromEntries(s.services.map((x) => [x.id, x.dailyTicketLimit?.toString() ?? ''])),
    );
  };

  useEffect(() => {
    if (user) void api.get<BranchSetupView>('/setup/branch').then(load);
  }, [user]);

  if (!user || !setup) return null;
  if (user.role !== 'branch_manager' && user.role !== 'business_admin') {
    return (
      <>
        <TopBar user={user} title="Settings" />
        <main className="page">
          <p className="error">Only managers and admins can change settings.</p>
        </main>
      </>
    );
  }

  const toNumber = (v: string) => (v.trim() === '' ? null : Number(v));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      let latest = await api.patch<BranchSetupView>('/setup/branch', {
        normalAfterPriority: toNumber(fairness),
      });
      for (const s of setup.services) {
        const next = toNumber(limits[s.id] ?? '');
        if (next !== s.dailyTicketLimit) {
          latest = await api.patch<BranchSetupView>(`/setup/services/${s.id}`, {
            dailyTicketLimit: next,
          });
        }
      }
      load(latest);
      setMessage({
        ok: true,
        text: 'Saved. Every screen in the branch uses the new settings now.',
      });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof ApiError ? err.message : 'Cannot reach the server',
      });
    }
  };

  return (
    <>
      <TopBar user={user} title={`Settings · ${setup.branch.name}`} />
      <main className="page">
        <form className="panel stack" onSubmit={save} style={{ maxWidth: 640 }}>
          <h1>Queue settings</h1>

          <div>
            <label htmlFor="fairness">
              Serve one normal ticket after this many priority tickets
            </label>
            <input
              id="fairness"
              type="number"
              min={1}
              max={20}
              placeholder="Off"
              value={fairness}
              onChange={(e) => setFairness(e.target.value)}
            />
            <p className="muted">
              Stops priority patients blocking everyone else on a busy day. Leave empty to always
              serve priority first.
            </p>
          </div>

          <div>
            <h2>Daily ticket limits</h2>
            <p className="muted">
              Leave empty for no limit. Counts every ticket that reaches the service today.
            </p>
            <ul className="list">
              {setup.services.map((s) => (
                <li key={s.id}>
                  <label htmlFor={`limit-${s.id}`} style={{ margin: 0 }}>
                    {s.name}
                  </label>
                  <input
                    id={`limit-${s.id}`}
                    type="number"
                    min={1}
                    placeholder="No limit"
                    style={{ maxWidth: 160 }}
                    value={limits[s.id] ?? ''}
                    onChange={(e) => setLimits({ ...limits, [s.id]: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          </div>

          {message && <p className={message.ok ? 'muted' : 'error'}>{message.text}</p>}
          <button className="btn btn-primary btn-big">Save settings</button>
        </form>
      </main>
    </>
  );
}
