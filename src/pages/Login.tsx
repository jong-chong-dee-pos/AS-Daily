import { useState, type ReactNode } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/context';

/** The sign-in screen: a frosted glass card over a colourful abstract background drawn in CSS. */
function GlassPage({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><i className="b5" /></div>
      {children}
    </div>
  );
}

const Brand = () => (
  <div className="login-brand">
    <span className="brand-mark">AS</span>
    <span><b>AS&amp;PWH Report</b><small>Assembly · Part Warehouse</small></span>
  </div>
);

export function Login() {
  const { noRole, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (noRole) {
    return (
      <GlassPage>
        <div className="login">
          <Brand />
          <h1>ยังไม่มีสิทธิ์ใช้งาน</h1>
          <p>บัญชีนี้ยังไม่ได้รับสิทธิ์ ติดต่อผู้ดูแลระบบให้กำหนดสิทธิ์ก่อน</p>
          <button type="button" onClick={signOut}>ออกจากระบบ</button>
        </div>
      </GlassPage>
    );
  }
  return (
    <GlassPage>
      <form className="login" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError('');
        try { await signInWithEmailAndPassword(auth, email.trim(), password); }
        catch { setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); }
        finally { setBusy(false); }
      }}>
        <Brand />
        <p className="login-hello">เข้าสู่ระบบเพื่อดูรายงาน</p>
        <label>อีเมล<input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>รหัสผ่าน<input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      </form>
    </GlassPage>
  );
}
