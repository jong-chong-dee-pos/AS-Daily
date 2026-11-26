import { Link } from 'react-router-dom';
import { atLeast, useAuth } from '../auth/context';
import { AREAS, accessOf, ap } from '../areas';

/**
 * The first page after sign-in: one card per work area. Areas still being built show a
 * "Coming soon" badge and cannot be opened; areas the user has no access to say so.
 */
export function AreaChooser({ manageUsers = true }: { manageUsers?: boolean }) {
  const { user, signOut } = useAuth();
  return (
    <div className="chooser">
      <div className="backdrop" aria-hidden="true"><i /><i /><i /></div>
      <header className="chooser-top">
        <div className="brand"><span className="brand-mark">AS</span><span>AS&amp;PWH Report</span></div>
        {user && (
          <div className="chooser-who">
            <span className="who-text"><b>{user.name}</b><small>{user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.email}</small></span>
            {signOut && <button type="button" className="link" onClick={signOut}>ออกจากระบบ</button>}
          </div>
        )}
      </header>
      <main className="chooser-main">
        <h1>เลือกพื้นที่งาน</h1>
        <p className="muted">เลือกพื้นที่งานที่ต้องการดูหรือกรอกข้อมูล เปลี่ยนได้ทุกเมื่อจากปุ่มพื้นที่งานด้านบนของทุกหน้า</p>
        <div className="area-cards">
          {AREAS.map((a) => {
            const access = accessOf(user, a.id);
            const body = (
              <>
                <span className="area-card-head">
                  <b>{a.label}</b>
                  {!a.ready && <span className="badge-soon">Coming soon</span>}
                </span>
                <span className="area-card-desc">{a.description}</span>
                <span className="area-card-foot">
                  {!a.ready ? 'ยังไม่เปิดใช้งาน' : access === 'none' ? 'ไม่มีสิทธิ์เข้าถึง ติดต่อผู้ดูแลระบบ' : access === 'edit' ? 'ดูและกรอกข้อมูล →' : 'ดูรายงาน →'}
                </span>
              </>
            );
            return a.ready && access !== 'none'
              ? <Link key={a.id} to={a.path} className="area-card">{body}</Link>
              : <div key={a.id} className="area-card disabled" aria-disabled="true">{body}</div>;
          })}
        </div>
        {manageUsers && atLeast(user?.role, 'admin') && (
          <p className="chooser-admin"><Link to={ap('/settings?tab=users')}>จัดการผู้ใช้และสิทธิ์แต่ละพื้นที่งาน</Link></p>
        )}
      </main>
    </div>
  );
}
