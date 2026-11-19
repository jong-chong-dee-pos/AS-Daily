import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '../index.css';
import { AuthContext, type AuthState } from '../auth/context';
import { RepoContext } from '../data/RepoContext';
import { makeArtifactRepo, type ArtifactDb } from '../data/artifactRepo';
import type { Repo } from '../data/repo';
import { setSaver } from '../export/save';
import { AppRoutes } from '../AppRoutes';

interface Host {
  use(name: 'db'): Promise<ArtifactDb | null>;
  use(name: 'user'): Promise<{ canEdit(): Promise<boolean>; me(): Promise<{ id: string | null; name: string; email: string | null }> } | null>;
  use(name: 'downloads'): Promise<{ save(r: { filename: string; data: Blob }): Promise<unknown> } | null>;
  use(name: 'assets'): Promise<{ upload(b: Blob): Promise<{ id: string; url: string }> } | null>;
}
const host = (window as unknown as { claude?: Host }).claude;

function ArtifactApp() {
  const [state, setState] = useState<{ repo?: Repo; auth: AuthState; error?: string }>(
    { auth: { user: null, noRole: false, loading: true } });

  useEffect(() => {
    const timer = setTimeout(() => setState((s) => s.repo ? s : { ...s, error: 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองเปิดหน้านี้ใหม่' }), 12000);
    (async () => {
      if (!host) { setState((s) => ({ ...s, error: 'เปิดหน้านี้จาก claude.ai เท่านั้น' })); return; }
      const [db, user, downloads, assets] = await Promise.all([host.use('db'), host.use('user'), host.use('downloads'), host.use('assets')]);
      if (downloads) setSaver(async (data, filename) => { await downloads.save({ filename, data }); });
      if (!db) { setState((s) => ({ ...s, error: 'ต้องเข้าสู่ระบบ claude.ai ก่อนจึงจะเห็นข้อมูล' })); return; }
      const [canEdit, me] = user ? await Promise.all([user.canEdit(), user.me()]) : [false, null];
      clearTimeout(timer);
      setState({
        repo: makeArtifactRepo(db, assets ? async (f) => (await assets.upload(f)).url : undefined),
        auth: {
          loading: false, noRole: false,
          user: { uid: me?.id ?? 'viewer', name: me?.name || 'ผู้ใช้', email: me?.email ?? '', role: canEdit ? 'admin' : 'viewer' },
        },
      });
    })().catch(() => setState((s) => ({ ...s, error: 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองเปิดหน้านี้ใหม่' })));
    return () => clearTimeout(timer);
  }, []);

  if (state.error) return <p className="empty">{state.error}</p>;
  if (!state.repo) return <p className="empty">กำลังโหลด…</p>;
  return (
    <AuthContext.Provider value={state.auth}>
      <RepoContext.Provider value={state.repo}>
        <HashRouter><AppRoutes manageUsers={false} /></HashRouter>
      </RepoContext.Provider>
    </AuthContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><ArtifactApp /></StrictMode>);
