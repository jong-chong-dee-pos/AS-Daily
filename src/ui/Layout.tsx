import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { RequireArea, atLeast, useAuth } from '../auth/context';
import { ACCESS_TH, AREAS, accessOf, areaById, inArea } from '../areas';
import type { AppUser, AreaAccess, AreaId } from '../types';

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

/** Who may see a menu item: anyone who can view the area, its data-entry users, or system admins. */
type Need = 'view' | 'edit' | 'admin';
type Group = { title: string; items: { to: string; label: string; icon: IconName; min: Need; keepPeriod?: boolean }[] };
const ASSEMBLY: Group[] = [
  { title: 'รายงาน', items: [
    { to: '/', label: 'Dashboard', icon: 'home', min: 'view', keepPeriod: true },
    { to: '/report/per', label: '% PER', icon: 'per', min: 'view', keepPeriod: true },
    { to: '/report/lot', label: 'Lot out', icon: 'lot', min: 'view', keepPeriod: true },
    { to: '/report/cost', label: 'ต้นทุน', icon: 'cost', min: 'view', keepPeriod: true },
  ] },
  { title: 'บันทึกข้อมูล', items: [
    { to: '/entry/daily', label: 'กรอกข้อมูลรายวัน', icon: 'entry', min: 'edit' },
    { to: '/entry/cost', label: 'กรอกข้อมูลรายเดือน', icon: 'coin', min: 'edit' },
  ] },
  { title: 'ระบบ', items: [{ to: '/settings', label: 'ตั้งค่า', icon: 'gear', min: 'admin' }] },
];
const PART_WAREHOUSE: Group[] = [
  { title: 'รายงาน', items: [{ to: '/', label: 'Dashboard', icon: 'home', min: 'view', keepPeriod: true }] },
  { title: 'บันทึกข้อมูล', items: [
    { to: '/entry/daily', label: 'กรอกแผนประกอบรายวัน', icon: 'entry', min: 'edit' },
    { to: '/entry/monthly', label: 'กรอกข้อมูลรายเดือน', icon: 'coin', min: 'edit' },
  ] },
  { title: 'ระบบ', items: [{ to: '/settings', label: 'ตั้งค่า', icon: 'gear', min: 'admin' }] },
];
const MENUS: Record<AreaId, Group[]> = { assembly: ASSEMBLY, partWarehouse: PART_WAREHOUSE };
const allowed = (user: AppUser | null, area: AreaId, min: Need) => {
  const a = accessOf(user, area);
  return min === 'admin' ? atLeast(user?.role, 'admin') : min === 'edit' ? a === 'edit' : a !== 'none';
};
/** The label under the user's name: system admins say so, everyone else sees their access here. */
export const whoLabel = (user: AppUser, area: AreaId) =>
  user.role === 'admin' ? 'ผู้ดูแลระบบ' : ACCESS_TH[accessOf(user, area)];

export function Layout({ area = 'assembly' }: { area?: AreaId }) {
  const { user, signOut } = useAuth();
  const { search } = useLocation();
  return (
    <div className="shell">
      <div className="backdrop" aria-hidden="true"><i /><i /><i /></div>
      <aside className="sidebar glass">
        <div className="brand"><span className="brand-mark">AS</span><span>รายงานประจำวัน</span></div>
        <AreaSwitcher current={area} />
        <nav aria-label="เมนูหลัก">
          {MENUS[area].map((g) => {
            const items = g.items.filter((n) => allowed(user, area, n.min));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.title}>
                <div className="nav-title">{g.title}</div>
                {items.map((n) => (
                  <NavLink key={n.to} to={{ pathname: inArea(area, n.to), search: n.keepPeriod ? search : '' }} end={n.to === '/'}>
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
            <span className="who-text"><b>{user.name}</b><small>{whoLabel(user, area)}</small></span>
            {signOut && <button type="button" className="link" onClick={signOut}>ออกจากระบบ</button>}
          </div>
        )}
      </aside>
      <main className="content"><RequireArea area={area} min="view"><Outlet /></RequireArea></main>
    </div>
  );
}

/**
 * The button with the current work area's name, at the top of every page. It opens a list
 * of all areas (ones not built yet are shown but cannot be chosen) and a link back to the
 * chooser. Closes on a choice, a click outside, or Escape.
 */
export function AreaSwitcher({ current }: { current: AreaId }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const note = (ready: boolean, a: AreaAccess) => (!ready ? 'Coming soon' : a === 'none' ? 'ไม่มีสิทธิ์เข้าถึง' : null);
  return (
    <div className="area-switch" ref={box}>
      <button ref={btn} type="button" className="area-btn" aria-haspopup="true" aria-expanded={open}
        aria-label={`พื้นที่งาน: ${areaById(current).label} (เปลี่ยนพื้นที่งาน)`} onClick={() => setOpen((o) => !o)}>
        <span className="area-btn-label"><small>พื้นที่งาน</small><b>{areaById(current).label}</b></span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="area-menu" role="menu" aria-label="เปลี่ยนพื้นที่งาน">
          {AREAS.map((a) => {
            const why = note(a.ready, accessOf(user, a.id));
            if (why) return (
              <span key={a.id} className="area-item disabled" role="menuitem" aria-disabled="true">
                <b>{a.label}</b><span className="soon">{why}</span>
              </span>
            );
            return (
              <Link key={a.id} to={a.path} role="menuitem" className={`area-item${a.id === current ? ' current' : ''}`}
                aria-current={a.id === current ? 'page' : undefined} onClick={() => setOpen(false)}>
                <b>{a.label}</b>{a.id === current && <span className="here">อยู่ที่นี่</span>}
              </Link>
            );
          })}
          <Link to="/" role="menuitem" className="area-item all" onClick={() => setOpen(false)}>ดูพื้นที่งานทั้งหมด</Link>
          {signOut && <button type="button" role="menuitem" className="area-item signout" onClick={() => { setOpen(false); void signOut(); }}>ออกจากระบบ</button>}
        </div>
      )}
    </div>
  );
}
