import { Route, Routes, useSearchParams } from 'react-router-dom';
import { RequireRole } from './auth/context';
import { Layout } from './ui/Layout';
import { Dashboard } from './pages/Dashboard';
import { ReportPer } from './pages/ReportPer';
import { ReportLot } from './pages/ReportLot';
import { LotFgDetail } from './pages/LotFgDetail';
import { ReportCost } from './pages/ReportCost';
import { EntryDaily } from './pages/EntryDaily';
import { EntryCost } from './pages/EntryCost';
import { Settings } from './pages/Settings';

export function AppRoutes({ manageUsers = true }: { manageUsers?: boolean }) {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="report/per" element={<ReportPer />} />
        <Route path="report/lot" element={<ReportLot />} />
        <Route path="report/lot/fg" element={<LotFgDetail />} />
        <Route path="report/cost" element={<ReportCost />} />
        <Route path="entry/daily" element={<RequireRole min="editor"><EntryDailyRoute /></RequireRole>} />
        <Route path="entry/cost" element={<RequireRole min="editor"><EntryCost /></RequireRole>} />
        <Route path="settings" element={<RequireRole min="admin"><Settings manageUsers={manageUsers} /></RequireRole>} />
        <Route path="*" element={<p className="empty">ไม่พบหน้านี้</p>} />
      </Route>
    </Routes>
  );
}

/** /entry/daily?d=YYYY-MM-DD opens that day (links from the Lot out FG details). */
function EntryDailyRoute() {
  const [sp] = useSearchParams();
  const d = sp.get('d');
  return <EntryDaily key={d ?? ''} initialDate={d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined} />;
}
