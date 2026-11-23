import type { UserRole } from '../generated/prisma/enums.js';

/** The signed-in user, attached to each request by the auth guard. */
export interface SessionUser {
  id: string;
  tenantId: string | null;
  branchId: string | null;
  name: string;
  email: string;
  role: UserRole;
  mustSetPassword: boolean;
}
