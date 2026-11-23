import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Rooms, type SocketEventName } from '@dozbyte/shared';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { cookieFromHeader, SESSION_COOKIE } from '../auth/session-token.js';

/**
 * Live updates (NFR-1). A staff screen connects with its session cookie and joins its branch room.
 * Events tell screens what changed; screens then fetch fresh state over HTTP, so a missed event
 * never leaves a screen wrong for long.
 */
@WebSocketGateway({
  cors: { origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = cookieFromHeader(socket.handshake.headers.cookie, SESSION_COOKIE);
    const user = await this.auth.userFromToken(token);
    if (!user?.branchId || user.mustSetPassword) {
      socket.emit('auth.error', { message: 'Please log in' });
      socket.disconnect(true);
      return;
    }
    await socket.join(Rooms.branch(user.branchId));
    this.logger.debug(`${user.email} connected to ${Rooms.branch(user.branchId)}`);
  }

  emitToBranch(branchId: string, event: SocketEventName, payload: unknown): void {
    this.server.to(Rooms.branch(branchId)).emit(event, payload);
  }
}
