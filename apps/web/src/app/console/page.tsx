'use client';

import type { BranchSetupView, CounterStateView, TicketView } from '@dozbyte/shared';
import { useCallback, useEffect, useState } from 'react';
import { TopBar } from '@/components/top-bar';
import { api, ApiError } from '@/lib/api';
import { capitalise, lagosTime, minutesSince } from '@/lib/format';
import { useLive } from '@/lib/use-live';
import { useSession } from '@/lib/use-session';

const COUNTER_KEY = 'dozbyte.counterId';

function rememberCounter(id: string | null) {
  try {
    if (id) localStorage.setItem(COUNTER_KEY, id);
    else localStorage.removeItem(COUNTER_KEY);
  } catch {
    // Private mode: the console still works, it just forgets the counter on reload.
  }
}

function rememberedCounter(): string | null {
  try {
    return localStorage.getItem(COUNTER_KEY);
  } catch {
    return null;
  }
}

/** Staff console (FR-7 to FR-9, design user flow 4). */
export default function ConsolePage() {
  const user = useSession();
  const [setup, setSetup] = useState<BranchSetupView | null>(null);
  const [counterId, setCounterId] = useState<string | null>(null);
  const [state, setState] = useState<CounterStateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendTo, setSendTo] = useState('');

  useEffect(() => {
    if (!user) return;
    void api.get<BranchSetupView>('/setup/branch').then((s) => {
      setSetup(s);
      const saved = rememberedCounter();
      const mine = s.counters.find((c) => c.signedInUserId === user.id);
      setCounterId(mine?.id ?? (saved && s.counters.some((c) => c.id === saved) ? saved : null));
    });
  }, [user]);

  const refresh = useCallback(() => {
    if (!counterId) return;
    api
      .get<CounterStateView>(`/counters/${counterId}`)
      .then(setState)
      .catch(() => undefined);
  }, [counterId]);
  useEffect(refresh, [refresh]);
  const live = useLive(refresh, Boolean(user && counterId));

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(path, body);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cannot reach the server');
    } finally {
      setBusy(false);
    }
  };

  if (!user || !setup) return null;
  const words = setup.wording;
  const serviceName = (id: string | null) => setup.services.find((s) => s.id === id)?.name;

  if (!counterId || !state) {
    return (
      <>
        <TopBar user={user} title="Staff console" />
        <main className="page">
          <section className="panel stack">
            <h1>Which {words.counter} are you at?</h1>
            <div className="choice-grid">
              {setup.counters.map((c) => (
                <button
                  key={c.id}
                  className="btn choice"
                  onClick={async () => {
                    try {
                      const s = await api.post<CounterStateView>(`/counters/${c.id}/sign-in`);
                      rememberCounter(c.id);
                      setCounterId(c.id);
                      setState(s);
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'Cannot reach the server');
                    }
                  }}
                >
                  <div>{c.name}</div>
                  <div className="muted">
                    {c.serviceIds.map(serviceName).join(', ')}
                    {c.signedInUserId && c.signedInUserId !== user.id && ' · in use'}
                  </div>
                </button>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
          </section>
        </main>
      </>
    );
  }

  const { counter, current, waiting } = state;
  const notMine = !counter.signedInByMe;
  const currentService = setup.services.find((s) => s.id === current?.serviceId);
  const nextName = serviceName(currentService?.nextServiceId ?? null);
  const otherStages = setup.services.filter((s) => s.id !== current?.serviceId);

  const leave = async () => {
    await act(`/counters/${counter.id}/sign-out`);
    rememberCounter(null);
    setCounterId(null);
    setState(null);
  };

  return (
    <>
      <TopBar user={user} title={`${counter.name} · ${counter.status}`} live={live} />
      <main className="page grid-2">
        <div className="stack">
          {notMine && (
            <section className="panel stack">
              <p className="error">You are not signed in to {counter.name}.</p>
              <button
                className="btn btn-primary"
                onClick={() => act(`/counters/${counter.id}/sign-in`)}
              >
                Sign in to {counter.name}
              </button>
            </section>
          )}

          <section className={current ? 'panel stack current' : 'panel stack'}>
            {current ? (
              <CurrentTicket ticket={current} words={words} setup={setup} />
            ) : (
              <>
                <h1>
                  No {words.customer} at your {words.counter}
                </h1>
                <p className="muted">
                  {counter.status === 'paused'
                    ? 'You are on a break. Resume to call again.'
                    : waiting.length
                      ? `${waiting.length} waiting. Call the next one when you are ready.`
                      : 'Nobody is waiting right now.'}
                </p>
              </>
            )}

            {!current && (
              <button
                className="btn btn-primary btn-big"
                disabled={busy || notMine || counter.status !== 'open' || waiting.length === 0}
                onClick={() => act(`/counters/${counter.id}/call-next`)}
              >
                Call next
              </button>
            )}

            {current?.status === 'called' && (
              <div className="btn-row">
                <button
                  className="btn btn-primary btn-big"
                  disabled={busy}
                  onClick={() => act(`/tickets/${current.id}/start`)}
                >
                  {capitalise(words.customer)} is here: Start
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => act(`/tickets/${current.id}/recall`)}
                >
                  Recall
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => act(`/tickets/${current.id}/no-show`)}
                >
                  No-show
                </button>
              </div>
            )}

            {current?.status === 'serving' && (
              <div className="stack">
                <button
                  className="btn btn-primary btn-big"
                  disabled={busy}
                  onClick={() => act(`/tickets/${current.id}/done`, { choice: { kind: 'next' } })}
                >
                  {nextName ? `Done: send to ${nextName}` : 'Done: end visit'}
                </button>
                <div className="btn-row">
                  <select
                    aria-label="Send to a different stage"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Send to a different stage…</option>
                    {otherStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    disabled={busy || !sendTo}
                    onClick={async () => {
                      await act(`/tickets/${current.id}/done`, {
                        choice: { kind: 'stage', serviceId: sendTo },
                      });
                      setSendTo('');
                    }}
                  >
                    Send
                  </button>
                  {nextName && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        act(`/tickets/${current.id}/done`, { choice: { kind: 'end' } })
                      }
                    >
                      End visit
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && <p className="error">{error}</p>}
          </section>

          <section className="btn-row">
            {counter.status === 'paused' ? (
              <button
                className="btn"
                disabled={busy || notMine}
                onClick={() => act(`/counters/${counter.id}/resume`)}
              >
                Resume
              </button>
            ) : (
              <button
                className="btn"
                disabled={busy || notMine}
                onClick={() => act(`/counters/${counter.id}/pause`)}
              >
                Pause for a break
              </button>
            )}
            <button className="btn btn-quiet" disabled={busy} onClick={leave}>
              Leave {counter.name}
            </button>
          </section>
        </div>

        <section className="panel">
          <h2>
            Waiting for {counter.serviceIds.map(serviceName).join(', ')} ({waiting.length})
          </h2>
          <p className="muted">In the order Call next will take them.</p>
          <ul className="list">
            {waiting.map((t) => (
              <li key={t.id} className={t.priorityLevel > 0 ? 'priority' : undefined}>
                <span>
                  <strong>{t.number}</strong> <span className="muted">{t.serviceName}</span>{' '}
                  {t.priorityReason && (
                    <span className="badge badge-priority">{capitalise(t.priorityReason)}</span>
                  )}
                </span>
                <span className="muted">waiting {minutesSince(t.sortTime)} min</span>
              </li>
            ))}
            {waiting.length === 0 && <li className="muted">Nobody waiting</li>}
          </ul>
        </section>
      </main>
    </>
  );
}

function CurrentTicket({
  ticket,
  words,
  setup,
}: {
  ticket: TicketView;
  words: BranchSetupView['wording'];
  setup: BranchSetupView;
}) {
  const extra = Object.entries((ticket.extraFields ?? {}) as Record<string, string | number>);
  const labels = new Map(setup.services.flatMap((s) => s.extraFields.map((f) => [f.key, f.label])));
  return (
    <div className="stack">
      <div className="muted">
        {ticket.status === 'called'
          ? `Called at ${ticket.calledAt ? lagosTime(ticket.calledAt) : ''}: waiting for the ${words.customer} to arrive`
          : `Serving since ${ticket.servingAt ? lagosTime(ticket.servingAt) : ''}`}
      </div>
      <div className="ticket-number">{ticket.number}</div>
      <div className="status-line">
        {ticket.serviceName}{' '}
        {ticket.priorityReason && (
          <span className="badge badge-priority">{capitalise(ticket.priorityReason)}</span>
        )}
      </div>
      {extra.length > 0 && (
        <ul className="list">
          {extra.map(([k, v]) => (
            <li key={k}>
              <span className="muted">{labels.get(k) ?? k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
