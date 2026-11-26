import type { AppUser, AreaAccess, AreaId, Role } from './types';

/**
 * The work areas of the app. Assembly holds every module built so far; its data stays in
 * the original top-level collections (perMonth, lotMonth, …). A new area keeps its data
 * under areas/{areaId}/… (see firestore.rules), so adding it never touches Assembly data.
 */
export interface Area { id: AreaId; label: string; path: string; ready: boolean; description: string }
export const AREAS: Area[] = [
  { id: 'assembly', label: 'Assembly', path: '/assembly', ready: true, description: '% PER, Lot out, ต้นทุน และ %OTD ของงานประกอบ' },
  { id: 'partWarehouse', label: 'Part Warehouse', path: '/part-warehouse', ready: true, description: 'Inventory, Turn Over, แผนประกอบรายวัน, Missing Part, Stock Diff, Plan Count และ % Performance' },
];
export const areaById = (id: AreaId) => AREAS.find((a) => a.id === id)!;
/** Path inside Assembly, e.g. ap('/entry/cost?m=2026-11') → '/assembly/entry/cost?m=2026-11'. */
export const ap = (path: string) => `/assembly${path === '/' ? '' : path}`;
/** Path inside any area, e.g. inArea('partWarehouse', '/entry/daily') → '/part-warehouse/entry/daily'. */
export const inArea = (area: AreaId, path: string) => `${areaById(area).path}${path === '/' ? '' : path}`;

/** Access when a user has no entry for the area: Assembly follows the old role, new areas start closed. */
const fallback = (role: Role, area: AreaId): AreaAccess =>
  area === 'assembly' ? (role === 'viewer' ? 'view' : 'edit') : 'none';

/** What the user may do in an area. System admins may do everything everywhere. */
export function accessOf(user: Pick<AppUser, 'role' | 'areas'> | null | undefined, area: AreaId): AreaAccess {
  if (!user) return 'none';
  if (user.role === 'admin') return 'edit';
  return user.areas?.[area] ?? fallback(user.role, area);
}
export const canView = (u: Parameters<typeof accessOf>[0], area: AreaId) => accessOf(u, area) !== 'none';
export const canEdit = (u: Parameters<typeof accessOf>[0], area: AreaId) => accessOf(u, area) === 'edit';

/**
 * The role stored next to the per-area access, kept in step so older code and the
 * Firestore rules read the same thing: admin stays admin, otherwise editor when the user
 * may enter data in any area, else viewer.
 */
export const roleFor = (admin: boolean, areas: Partial<Record<AreaId, AreaAccess>>): Role =>
  admin ? 'admin' : Object.values(areas).includes('edit') ? 'editor' : 'viewer';

export const ACCESS_TH: Record<AreaAccess, string> = { none: 'ไม่มีสิทธิ์', view: 'ดูอย่างเดียว', edit: 'ดูและกรอกข้อมูล' };
