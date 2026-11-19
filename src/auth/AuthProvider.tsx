import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AppUser, Role } from '../types';

export interface AuthState {
  user: AppUser | null;
  /** Signed in to Firebase but no role assigned yet. */
  noRole: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null, noRole: false, loading: true, signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
export const atLeast = (role: Role | undefined, min: Role) => role !== undefined && RANK[role] >= RANK[min];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'signOut'>>({ user: null, noRole: false, loading: true });
  useEffect(() => onAuthStateChanged(auth, async (fb) => {
    if (!fb) return setState({ user: null, noRole: false, loading: false });
    try {
      const snap = await getDoc(doc(db, 'users', fb.uid));
      if (!snap.exists()) return setState({ user: null, noRole: true, loading: false });
      const d = snap.data();
      setState({ user: { uid: fb.uid, name: d.name ?? fb.email ?? '', email: fb.email ?? '', role: d.role }, noRole: false, loading: false });
    } catch {
      setState({ user: null, noRole: true, loading: false });
    }
  }), []);
  return <AuthContext.Provider value={{ ...state, signOut: () => fbSignOut(auth) }}>{children}</AuthContext.Provider>;
}

export function RequireRole({ min, children }: { min: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!atLeast(user?.role, min)) return <p className="empty">หน้านี้สำหรับ{min === 'admin' ? 'ผู้ดูแล' : 'ผู้กรอกข้อมูล'}เท่านั้น</p>;
  return <>{children}</>;
}
