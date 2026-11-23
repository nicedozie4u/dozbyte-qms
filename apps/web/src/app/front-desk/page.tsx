'use client';

import type { BranchQueueView, BranchSetupView, IssuedTicketView } from '@dozbyte/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { TopBar } from '@/components/top-bar';
import { api, ApiError } from '@/lib/api';
import { capitalise } from '@/lib/format';
import { useLive } from '@/lib/use-live';
import { useSession } from '@/lib/use-session';

/** Front desk (FR-1, FR-3, FR-6): issue a ticket and see the queues at a glance. */
export default function FrontDeskPage() {
  const user = useSession();
  const [setup, setSetup] = useState<BranchSetupView | null>(null);
  const [queue, setQueue] = useState<BranchQueueView | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [priority, setPriority] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [issued, setIssued] = useState<IssuedTicketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void api.get<BranchSetupView>('/setup/branch').then(setSetup);
  }, [user]);

  const refresh = useCallback(() => {
    void api
      .get<BranchQueueView>('/queue')
      .then(setQueue)
      .catch(() => undefined);
  }, []);
  const live = useLive(refresh, Boolean(user));

  if (!user || !setup) return null;
  const words = setup.wording;
  const services = [...setup.services].sort((a, b) => Number(b.kioskStart) - Number(a.kioskStart));
  const chosen = setup.services.find((s) => s.id === serviceId) ?? null;

  const issue = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const extra = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== ''));
      const result = await api.post<IssuedTicketView>('/tickets', {
        serviceId: chosen.id,
        priorityReason: priority || undefined,
        extraFields: Object.keys(extra).length ? extra : undefined,
      });
      setIssued(result);
      setPriority('');
      setFields({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cannot reach the server');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar user={user} title={`Front desk · ${setup.branch.name}`} live={live} />
      <main className="page grid-2">
        <form className="panel stack" onSubmit={issue}>
          <h1>New ticket</h1>
          <div>
            <label>Service</label>
            <div className="choice-grid">
              {services.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="btn choice"
                  aria-pressed={s.id === serviceId}
                  onClick={() => {
                    setServiceId(s.id);
                    setFields({});
                  }}
                >
                  <div>{s.name}</div>
                  <div className="muted">Ticket {s.prefix}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">None</option>
              {setup.priorityReasons.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {chosen?.extraFields.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key}>
                {f.label} {!f.required && <span className="muted">(optional)</span>}
              </label>
              <input
                id={f.key}
                type={f.type === 'number' ? 'number' : 'text'}
                required={f.required}
                value={fields[f.key] ?? ''}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
              />
            </div>
          ))}

          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-big" disabled={!chosen || busy}>
            {busy ? 'Issuing…' : chosen ? `Issue ${chosen.name} ticket` : 'Pick a service'}
          </button>
        </form>

        <div className="stack">
          {issued && (
            <section className="panel ticket-card" aria-live="polite">
              <div className="muted">Give this number to the {words.customer}</div>
              <div className="ticket-number">{issued.ticket.number}</div>
              <div className="status-line">{issued.ticket.serviceName}</div>
              <p className="muted">
                {issued.peopleAhead === 0
                  ? `Next in line`
                  : `${issued.peopleAhead ?? '?'} ${words.customers} ahead`}
                {issued.waitMinutes !== null &&
                  issued.peopleAhead !== 0 &&
                  ` · about ${issued.waitMinutes} min`}
                {issued.waitMinutes === null && ` · no ${words.counter} open yet`}
              </p>
              {issued.ticket.priorityReason && (
                <span className="badge badge-priority">Priority</span>
              )}
            </section>
          )}

          <section className="panel">
            <h2>Waiting now</h2>
            <ul className="list">
              {queue?.services.map((s) => (
                <li key={s.id}>
                  <span>{s.name}</span>
                  <span className="muted">
                    {s.waiting} waiting · {s.countersOpen}{' '}
                    {s.countersOpen === 1 ? words.counter : `${words.counter}s`} open
                    {s.nextWaitMinutes !== null && s.waiting > 0 && ` · ~${s.nextWaitMinutes} min`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted">
              {capitalise(words.customers)} move between stages on their own once staff click Done.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
