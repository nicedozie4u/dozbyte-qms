'use client';

import { SocketEvents } from '@dozbyte/shared';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env['NEXT_PUBLIC_SOCKET_URL'] ?? 'http://localhost:3001';
const events = Object.values(SocketEvents);

/**
 * Calls `onChange` whenever the branch queue changes, and every 15 seconds as a safety net.
 * Returns whether the live connection is up, so screens can say when it is not.
 */
export function useLive(onChange: () => void, enabled = true): boolean {
  const [connected, setConnected] = useState(false);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket'] });
    const refresh = () => latest.current();
    socket.on('connect', () => {
      setConnected(true);
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('auth.error', () => window.location.assign('/login'));
    for (const e of events) socket.on(e, refresh);
    const timer = setInterval(refresh, 15_000);
    return () => {
      clearInterval(timer);
      socket.close();
    };
  }, [enabled]);

  return connected;
}
