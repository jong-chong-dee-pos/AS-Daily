import { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { RepoContext } from './data/RepoContext';
import { makeRepo } from './data/repo';
import { auth, db } from './firebase';
import { Login } from './pages/Login';
import { AppRoutes } from './AppRoutes';

function Gate() {
  const { user, loading } = useAuth();
  const repo = useMemo(() => makeRepo(db, () => auth.currentUser?.uid ?? ''), []);
  if (loading) return <p className="empty">กำลังโหลด…</p>;
  if (!user) return <Login />;
  return <RepoContext.Provider value={repo}><AppRoutes /></RepoContext.Provider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Gate /></AuthProvider>
    </BrowserRouter>
  );
}
