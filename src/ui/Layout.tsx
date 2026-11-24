import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { atLeast, useAuth } from '../auth/context';
import type { Role } from '../types';

type IconName = 'home' | 'per' | 'lot' | 'cost' | 'entry' | 'coin' | 'gear';
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  per: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  lot: 'M12 3 3 7.5 12 12l9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  cost: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  entry: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9.5c0-1.4 1.3-2 3-2s3 .7 3 2-1.3 1.8-3 2.2-3 .9-3 2.3 1.3 2 3 2 3-.6 3-2M12 6v1.5M12 16.5V18',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 7 4.3l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

const GROUPS: { title: string; items: { to: string; label: string; icon: IconName; min: Role; keepPeriod?: boolean }[] }[] = [
  { title: 'รายงาน', items: [
    { to: '/', label: 'Dashboard', icon: 'home', min: 'viewer', keepPeriod: true },
    { to: '/report/per', label: '% PER', icon: 'per', min: 'viewer', keepPeriod: true },
    { to: '/report/lot', label: 'Lot out', icon: 'lot', min: 'viewer', keepPeriod: true },
    { to: '/report/cost', label: 'ต้นทุน', icon: 'cost', min: 'viewer', keepPeriod: true },
  ] },
  { title: 'บันทึกข้อมูล', items: [
    { to: '/entry/daily', label: 'กรอกข้อมูลรายวัน', icon: 'entry', min: 'editor' },
    { to: '/entry/cost', label: 'กรอกข้อมูลรายเดือน', icon: 'coin', min: 'editor' },
  ] },
  { title: 'ระบบ', items: [{ to: '/settings', label: 'ตั้งค่า', icon: 'gear', min: 'admin' }] },
];
const ROLE_TH: Record<Role, string> = { admin: 'ผู้ดูแล', editor: 'ผู้กรอก', viewer: 'ผู้ดู' };

export function Layout() {
  const { user, signOut } = useAuth();
  const { search } = useLocation();
  return (
    <div className="shell">
      <div className="backdrop" aria-hidden="true"><i /><i /><i /></div>
      <aside className="sidebar glass">
        <div className="brand"><span className="brand-mark">AS</span><span>รายงานประจำวัน</span></div>
        <nav aria-label="เมนูหลัก">
          {GROUPS.map((g) => {
            const items = g.items.filter((n) => atLeast(user?.role, n.min));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.title}>
                <div className="nav-title">{g.title}</div>
                {items.map((n) => (
                  <NavLink key={n.to} to={{ pathname: n.to, search: n.keepPeriod ? search : '' }} end={n.to === '/'}>
                    <Icon name={n.icon} /><span>{n.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        {user && (
          <div className="who">
            <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
            <span className="who-text"><b>{user.name}</b><small>{ROLE_TH[user.role]}</small></span>
            {signOut && <button type="button" className="link" onClick={signOut}>ออกจากระบบ</button>}
          </div>
        )}
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
