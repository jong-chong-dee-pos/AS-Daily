import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthContext, type AuthState } from './context';

export { AuthContext, atLeast, RequireRole, useAuth, type AuthState } from './context';

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
