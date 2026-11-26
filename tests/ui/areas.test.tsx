// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// Dashboard charts measure their box.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('../../src/firebase', () => ({ auth: {}, db: {} }));
import { AuthContext } from '../../src/auth/context';
import { RepoContext } from '../../src/data/RepoContext';
import { AppRoutes } from '../../src/AppRoutes';
import { accessOf, ap, roleFor } from '../../src/areas';
import type { AppUser } from '../../src/types';
import { fakeRepo } from './fakeRepo';

const U = (role: AppUser['role'], areas?: AppUser['areas']): AppUser => ({ uid: 'u', name: 'สมศรี', email: 's@x.com', role, ...(areas ? { areas } : {}) });

function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname + l.search}</output>; }
const renderAt = (path: string, user: AppUser) => render(
  <AuthContext.Provider value={{ user, noRole: false, loading: false, signOut: async () => {} }}>
    <RepoContext.Provider value={fakeRepo({})}>
      <MemoryRouter initialEntries={[path]}><AppRoutes /><Where /></MemoryRouter>
    </RepoContext.Provider>
  </AuthContext.Provider>,
);

describe('access per work area', () => {
  it('users saved before work areas keep their Assembly access, other areas start closed', () => {
    expect(accessOf(U('viewer'), 'assembly')).toBe('view');
    expect(accessOf(U('editor'), 'assembly')).toBe('edit');
    expect(accessOf(U('viewer'), 'partWarehouse')).toBe('none');
    expect(accessOf(U('editor'), 'partWarehouse')).toBe('none');
  });
  it('the per-area setting wins over the role; admins may do everything', () => {
    expect(accessOf(U('editor', { assembly: 'view' }), 'assembly')).toBe('view');
    expect(accessOf(U('viewer', { assembly: 'none' }), 'assembly')).toBe('none');
    expect(accessOf(U('admin', { assembly: 'none' }), 'assembly')).toBe('edit');
    expect(accessOf(null, 'assembly')).toBe('none');
  });
  it('the stored role follows the areas', () => {
    expect(roleFor(true, { assembly: 'none' })).toBe('admin');
    expect(roleFor(false, { assembly: 'view', partWarehouse: 'edit' })).toBe('editor');
    expect(roleFor(false, { assembly: 'view', partWarehouse: 'none' })).toBe('viewer');
  });
  it('ap() puts a path under Assembly', () => {
    expect(ap('/')).toBe('/assembly');
    expect(ap('/entry/cost?m=2026-11')).toBe('/assembly/entry/cost?m=2026-11');
  });
});

describe('work-area chooser', () => {
  it('shows Assembly as a link and Part Warehouse as Coming soon', () => {
    renderAt('/', U('viewer'));
    expect(screen.getByRole('heading', { name: 'เลือกพื้นที่งาน' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Assembly/ })).toHaveAttribute('href', '/assembly');
    expect(screen.queryByRole('link', { name: /Part Warehouse/ })).toBeNull();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.queryByText(/จัดการผู้ใช้/)).toBeNull();
  });
  it('a user without Assembly access sees it but cannot open it', () => {
    renderAt('/', U('viewer', { assembly: 'none' }));
    expect(screen.queryByRole('link', { name: /Assembly/ })).toBeNull();
    expect(screen.getByText('ไม่มีสิทธิ์เข้าถึง ติดต่อผู้ดูแลระบบ')).toBeInTheDocument();
  });
  it('admins get a link to the users and permissions page', () => {
    renderAt('/', U('admin'));
    fireEvent.click(screen.getByRole('link', { name: 'จัดการผู้ใช้และสิทธิ์แต่ละพื้นที่งาน' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/assembly/settings?tab=users');
    expect(screen.getByRole('tab', { name: 'ผู้ใช้และสิทธิ์' })).toHaveAttribute('aria-selected', 'true');
  });
  it('clicking Assembly opens its Dashboard', () => {
    renderAt('/', U('viewer'));
    fireEvent.click(screen.getByRole('link', { name: /Assembly/ }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/assembly$/);
    expect(screen.getByRole('button', { name: /พื้นที่งาน: Assembly/ })).toBeInTheDocument();
  });
});

describe('work-area switcher', () => {
  it('lists the areas, Part Warehouse disabled, and goes back to the chooser', () => {
    renderAt('/assembly/report/per', U('viewer'));
    const btn = screen.getByRole('button', { name: /พื้นที่งาน: Assembly/ });
    fireEvent.click(btn);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Assembly/ })).toHaveAttribute('aria-current', 'page');
    expect(within(menu).getByRole('menuitem', { name: /Part Warehouse/ })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(btn);
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'ดูพื้นที่งานทั้งหมด' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });
  it('closes on a click outside', () => {
    renderAt('/assembly', U('viewer'));
    fireEvent.click(screen.getByRole('button', { name: /พื้นที่งาน: Assembly/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('pages follow the access of the work area', () => {
  it('a view-only user sees no entry menu and cannot open entry pages', () => {
    renderAt('/assembly/entry/daily', U('editor', { assembly: 'view' }));
    expect(screen.queryByRole('link', { name: 'กรอกข้อมูลรายวัน' })).toBeNull();
    expect(screen.getByText('หน้านี้สำหรับผู้กรอกข้อมูลเท่านั้น')).toBeInTheDocument();
  });
  it('a data-entry user of Assembly gets the entry menu under /assembly', () => {
    renderAt('/assembly', U('viewer', { assembly: 'edit' }));
    expect(screen.getByRole('link', { name: 'กรอกข้อมูลรายวัน' })).toHaveAttribute('href', '/assembly/entry/daily');
    expect(screen.queryByRole('link', { name: 'ตั้งค่า' })).toBeNull();
  });
  it('a user without access to Assembly is stopped at every Assembly page', () => {
    renderAt('/assembly/report/cost', U('viewer', { assembly: 'none' }));
    expect(screen.getByText('คุณยังไม่มีสิทธิ์เข้าพื้นที่งานนี้ ติดต่อผู้ดูแลระบบ')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ต้นทุน' })).toBeNull();
  });
  it('old addresses open the same page under Assembly, keeping the query', () => {
    renderAt('/report/per?y=2026', U('viewer'));
    expect(screen.getByTestId('where')).toHaveTextContent('/assembly/report/per?y=2026');
    renderAt('/entry/cost?m=2026-10', U('admin'));
    expect(screen.getAllByTestId('where')[1]).toHaveTextContent('/assembly/entry/cost?m=2026-10');
  });
  it('an unknown address goes to the chooser', () => {
    renderAt('/nothing-here', U('viewer'));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });
});
