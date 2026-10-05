import type { StoredSession } from '../utils/authStorage';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Response shape of POST /auth/login (and the dormant /auth/vipps/exchange). */
export type LoginSession = StoredSession & { user: AuthUser };
