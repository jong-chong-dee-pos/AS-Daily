import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { atLeast, useAuth } from '../auth/context';
import type { Role } from '../types';

const NAV: { to: string; label: string; min: Role; keepPeriod?: boolean }[] = [
  { to: '/', label: 'Dashboard', min: 'viewer', keepPeriod: true },
  { to: '/report/per', label: '% PER', min: 'viewer', keepPeriod: true },
  { to: '/report/lot', label: 'Lot out', min: 'viewer', keepPeriod: true },
  { to: '/report/cost', label: 'ต้นทุน', min: 'viewer', keepPeriod: true },
  { to: '/entry/daily', label: 'กรอกข้อมูลรายวัน', min: 'editor' },
  { to: '/entry/cost', label: 'กรอกต้นทุน', min: 'editor' },
  { to: '/settings', label: 'ตั้งค่า', min: 'admin' },
];
const ROLE_TH: Record<Role, string> = { admin: 'ผู้ดูแล', editor: 'ผู้กรอก', viewer: 'ผู้ดู' };

export function Layout() {
  const { user, signOut } = useAuth();
  const { search } = useLocation();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">AS</span> รายงานประจำวัน</div>
        <nav aria-label="เมนูหลัก">
          {NAV.filter((n) => atLeast(user?.role, n.min)).map((n) => (
            <NavLink key={n.to} to={{ pathname: n.to, search: n.keepPeriod ? search : '' }} end={n.to === '/'}>{n.label}</NavLink>
          ))}
        </nav>
        {user && (
          <div className="who">
            <span>{user.name} · {ROLE_TH[user.role]}</span>
            {signOut && <button type="button" className="link" onClick={signOut}>ออกจากระบบ</button>}
          </div>
        )}
      </header>
      <main className="content"><Outlet /></main>
    </div>
  );
}
