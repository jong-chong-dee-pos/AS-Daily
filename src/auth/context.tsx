import { createContext, useContext } from 'react';
import type { AppUser, Role } from '../types';

export interface AuthState {
  user: AppUser | null;
  /** Signed in but no role assigned yet. */
  noRole: boolean;
  loading: boolean;
  /** Absent where sign-in is handled by the host (Claude artifact). */
  signOut?: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({ user: null, noRole: false, loading: true });
export const useAuth = () => useContext(AuthContext);

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
export const atLeast = (role: Role | undefined, min: Role) => role !== undefined && RANK[role] >= RANK[min];

export function RequireRole({ min, children }: { min: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!atLeast(user?.role, min)) return <p className="empty">หน้านี้สำหรับ{min === 'admin' ? 'ผู้ดูแล' : 'ผู้กรอกข้อมูล'}เท่านั้น</p>;
  return <>{children}</>;
}
