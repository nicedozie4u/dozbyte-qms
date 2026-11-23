import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Rooms, type SocketEventName } from '@dozbyte/shared';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { cookieFromHeader, SESSION_COOKIE } from '../auth/session-token.js';

/** How often open sockets are checked against their session and account. */
export const SESSION_RECHECK_MS = 60_000;

interface SocketData {
  token?: string;
  userId?: string;
}

/**
 * Live updates (NFR-1). A staff screen connects with its session cookie and joins its branch room.
 * Events tell screens what changed; screens then fetch fresh state over HTTP, so a missed event
 * never leaves a screen wrong for long. Sockets whose session expires, or whose account is
 * switched off, are told and disconnected within a minute.
 */
@WebSocketGateway({
  cors: { origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private recheck: NodeJS.Timeout | undefined;

  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  afterInit(): void {
    this.recheck = setInterval(() => void this.recheckSessions(), SESSION_RECHECK_MS);
    this.recheck.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.recheck);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = cookieFromHeader(socket.handshake.headers.cookie, SESSION_COOKIE);
    const user = await this.auth.userFromToken(token);
    if (!user?.branchId || user.mustSetPassword) {
      this.reject(socket);
      return;
    }
    const data = socket.data as SocketData;
    data.token = token;
    data.userId = user.id;
    await socket.join(Rooms.branch(user.branchId));
    this.logger.debug(`${user.email} connected to ${Rooms.branch(user.branchId)}`);
  }

  emitToBranch(branchId: string, event: SocketEventName, payload: unknown): void {
    this.server.to(Rooms.branch(branchId)).emit(event, payload);
  }

  /** Disconnects sockets whose session ended or whose account was switched off. */
  async recheckSessions(): Promise<void> {
    const sockets = await this.server.fetchSockets();
    await Promise.all(
      sockets.map(async (s) => {
        const user = await this.auth.userFromToken((s.data as SocketData).token);
        if (!user) {
          s.emit('auth.error', { message: 'Your session has ended. Please log in again.' });
          s.disconnect(true);
        }
      }),
    );
  }

  private reject(socket: Socket) {
    socket.emit('auth.error', { message: 'Please log in' });
    socket.disconnect(true);
  }
}
