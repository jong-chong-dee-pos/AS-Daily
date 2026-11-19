import { useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireRole, useAuth } from './auth/AuthProvider';
import { RepoContext } from './data/RepoContext';
import { makeRepo } from './data/repo';
import { auth, db } from './firebase';
import { Layout } from './ui/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ReportPer } from './pages/ReportPer';
import { ReportLot } from './pages/ReportLot';
import { ReportCost } from './pages/ReportCost';
import { EntryDaily } from './pages/EntryDaily';
import { EntryCost } from './pages/EntryCost';
import { Settings } from './pages/Settings';

function Gate() {
  const { user, loading } = useAuth();
  const repo = useMemo(() => makeRepo(db, () => auth.currentUser?.uid ?? ''), []);
  if (loading) return <p className="empty">กำลังโหลด…</p>;
  if (!user) return <Login />;
  return (
    <RepoContext.Provider value={repo}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="report/per" element={<ReportPer />} />
          <Route path="report/lot" element={<ReportLot />} />
          <Route path="report/cost" element={<ReportCost />} />
          <Route path="entry/daily" element={<RequireRole min="editor"><EntryDaily /></RequireRole>} />
          <Route path="entry/cost" element={<RequireRole min="editor"><EntryCost /></RequireRole>} />
          <Route path="settings" element={<RequireRole min="admin"><Settings /></RequireRole>} />
          <Route path="*" element={<p className="empty">ไม่พบหน้านี้</p>} />
        </Route>
      </Routes>
    </RepoContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Gate /></AuthProvider>
    </BrowserRouter>
  );
}
