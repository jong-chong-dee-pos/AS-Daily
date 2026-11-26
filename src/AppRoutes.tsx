import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { RequireArea, RequireRole } from './auth/context';
import { Layout } from './ui/Layout';
import { AreaChooser } from './pages/AreaChooser';
import { Dashboard } from './pages/Dashboard';
import { ReportPer } from './pages/ReportPer';
import { ReportLot } from './pages/ReportLot';
import { LotFgDetail } from './pages/LotFgDetail';
import { ReportCost } from './pages/ReportCost';
import { EntryDaily } from './pages/EntryDaily';
import { EntryCost } from './pages/EntryCost';
import { Settings } from './pages/Settings';
import { PwDashboard } from './pages/pw/PwDashboard';
import { PwEntryDaily } from './pages/pw/PwEntryDaily';
import { PwEntryMonthly } from './pages/pw/PwEntryMonthly';
import { PwSettings } from './pages/pw/PwSettings';

/**
 * "/" is the work-area chooser. Every Assembly module lives under /assembly; links saved
 * before work areas existed (/report/per, /entry/daily?d=…, /settings) still open the same page.
 */
export function AppRoutes({ manageUsers = true }: { manageUsers?: boolean }) {
  return (
    <Routes>
      <Route index element={<AreaChooser manageUsers={manageUsers} />} />
      <Route path="assembly" element={<Layout area="assembly" />}>
        <Route index element={<Dashboard />} />
        <Route path="report/per" element={<ReportPer />} />
        <Route path="report/lot" element={<ReportLot />} />
        <Route path="report/lot/fg" element={<LotFgDetail />} />
        <Route path="report/cost" element={<ReportCost />} />
        <Route path="entry/daily" element={<RequireArea area="assembly" min="edit"><EntryDailyRoute /></RequireArea>} />
        <Route path="entry/cost" element={<RequireArea area="assembly" min="edit"><EntryCostRoute /></RequireArea>} />
        <Route path="settings" element={<RequireRole min="admin"><SettingsRoute manageUsers={manageUsers} /></RequireRole>} />
        <Route path="*" element={<p className="empty">ไม่พบหน้านี้</p>} />
      </Route>
      <Route path="part-warehouse" element={<Layout area="partWarehouse" />}>
        <Route index element={<PwDashboard />} />
        <Route path="entry/daily" element={<RequireArea area="partWarehouse" min="edit"><PwEntryDaily /></RequireArea>} />
        <Route path="entry/monthly" element={<RequireArea area="partWarehouse" min="edit"><PwEntryMonthly /></RequireArea>} />
        <Route path="settings" element={<RequireRole min="admin"><PwSettings manageUsers={manageUsers} /></RequireRole>} />
        <Route path="*" element={<p className="empty">ไม่พบหน้านี้</p>} />
      </Route>
      <Route path="report/*" element={<ToAssembly />} />
      <Route path="entry/*" element={<ToAssembly />} />
      <Route path="settings" element={<ToAssembly />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Old address → the same page under /assembly, keeping its ?query. */
function ToAssembly() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/assembly${pathname}${search}`} replace />;
}

/** /assembly/settings?tab=users opens the users and permissions tab (link on the chooser). */
function SettingsRoute({ manageUsers }: { manageUsers: boolean }) {
  const [sp] = useSearchParams();
  const tab = sp.get('tab');
  return <Settings key={tab ?? ''} manageUsers={manageUsers} initialTab={tab === 'users' && manageUsers ? 'users' : undefined} />;
}

/** /assembly/entry/daily?d=YYYY-MM-DD opens that day (links from the Lot out FG details). */
function EntryDailyRoute() {
  const [sp] = useSearchParams();
  const d = sp.get('d');
  return <EntryDaily key={d ?? ''} initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined} />;
}

/** /assembly/entry/cost?m=YYYY-MM opens that month (links from the cost report and Dashboard). */
function EntryCostRoute() {
  const [sp] = useSearchParams();
  const m = sp.get('m');
  return <EntryCost key={m ?? ''} initialMonth={m && /^\d{4}-\d{2}$/.test(m) ? m : undefined} />;
}
