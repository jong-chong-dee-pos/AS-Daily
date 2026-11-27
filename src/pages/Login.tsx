import { useState, type ReactNode } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/context';

const MAIL = 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM3.5 6.5 12 13l8.5-6.5';
const LOCK = 'M6 10.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1zM8 10.5V7.5a4 4 0 0 1 8 0v3M12 15v2.5';
const FieldIcon = ({ d }: { d: string }) => (
  <svg className="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/**
 * The sign-in screen, split in two: a colour panel on the left (logo and welcome line over
 * blurred colour bands seen through fluted glass, all drawn in CSS) and the form on white.
 */
function SplitPage({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-bands" aria-hidden="true"><i className="k1" /><i className="k2" /><i className="k3" /><i className="k4" /><i className="k5" /></div>
        <div className="login-logo"><span className="brand-mark">AS</span><b>AS&amp;PWH Report</b></div>
        <div className="login-welcome">
          <p className="w1">Welcome to</p>
          <p className="w2">AS&amp;PWH Report</p>
          <p className="w3">รายงานประจำวันและรายเดือน ของ Assembly และ Part Warehouse</p>
        </div>
      </section>
      <section className="login-side">{children}</section>
    </div>
  );
}

export function Login() {
  const { noRole, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (noRole) {
    return (
      <SplitPage>
        <div className="login">
          <h1 className="login-title">ยังไม่มีสิทธิ์ใช้งาน</h1>
          <p className="login-sub">บัญชีนี้ยังไม่ได้รับสิทธิ์ ติดต่อผู้ดูแลระบบให้กำหนดสิทธิ์ก่อน</p>
          <button type="button" onClick={signOut}>ออกจากระบบ</button>
        </div>
      </SplitPage>
    );
  }
  return (
    <SplitPage>
      <form className="login" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try { await signInWithEmailAndPassword(auth, email.trim(), password); }
        catch { setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); }
        finally { setBusy(false); }
      }}>
        <h1 className="login-title">Login</h1>
        <p className="login-sub">เข้าสู่ระบบเพื่อดูรายงาน</p>
        <label className="field">
          <span className="field-label">อีเมล</span>
          <span className="field-box"><FieldIcon d={MAIL} />
            <input id="login-email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </span>
        </label>
        <label className="field">
          <span className="field-label">รหัสผ่าน</span>
          <span className="field-box"><FieldIcon d={LOCK} />
            <input id="login-password" type="password" autoComplete="current-password" placeholder="รหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        <p className="login-help">ลืมรหัสผ่านหรือยังไม่มีบัญชี ติดต่อผู้ดูแลระบบ</p>
      </form>
    </SplitPage>
  );
}
