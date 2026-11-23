import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
  type Firestore, type QueryConstraint,
} from 'firebase/firestore';
import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import type { AppUser, Role } from '../types';
import { makeArtifactRepo, type ArtifactDb, type ArtifactQuery, type BaseRepo } from './artifactRepo';

/** What pages use; the Firebase-only extras are absent on the Claude artifact. */
export type Repo = BaseRepo & {
  getImage?: (id: string) => Promise<string>;
  createUser?: (u: Omit<AppUser, 'uid'>, password: string) => Promise<string>;
  deleteUser?: (uid: string) => Promise<void>;
  importDocs?: (docs: { path: string; data: Record<string, unknown> }[], onProgress?: (done: number) => void) => Promise<void>;
};

/**
 * Firestore with the same document layout as the Claude artifact
 * (perMonth/YYYY-MM, lotMonth/YYYY-MM, … one document per month), so a year report
 * reads about a dozen documents and the artifact data can be copied over unchanged.
 * Every write is stamped with the signed-in uid (the rules check it).
 */
export function firestoreAdapter(db: Firestore, uid: () => string): ArtifactDb {
  const ref = (path: string) => doc(db, path);
  const q = (name: string, cs: QueryConstraint[]): ArtifactQuery => ({
    where: (f, op, v) => q(name, [...cs, where(f, op as '>=' | '<=' | '==', v)]),
    get: async () => ({
      docs: (await getDocs(query(collection(db, name), ...cs))).docs.map((d) => ({ id: d.id, exists: true, data: () => d.data() })),
    }),
  });
  return {
    doc: (path) => ({
      get: async () => { const s = await getDoc(ref(path)); return { id: s.id, exists: s.exists(), data: () => s.data() }; },
      set: (d) => setDoc(ref(path), { ...d, updatedBy: uid(), updatedAt: serverTimestamp() }),
      delete: () => deleteDoc(ref(path)),
    }),
    collection: (name) => q(name, []),
  };
}

/** Shrinks a photo to a JPEG data URL small enough for one Firestore document. */
export async function compressImage(f: Blob, max = 1280, quality = 0.7): Promise<string> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  let q = quality, url = c.toDataURL('image/jpeg', q);
  while (url.length > 700_000 && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  return url;
}

export const IMG_PREFIX = 'fsimg:';

/** Data access for one signed-in user on Firebase. */
export function makeRepo(db: Firestore, uid: () => string, options?: FirebaseOptions): Repo {
  const adapter = firestoreAdapter(db, uid);
  const uploadImage = async (f: Blob) => {
    const id = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await adapter.doc(`images/${id}`).set({ data: await compressImage(f) });
    return IMG_PREFIX + id;
  };
  const base = makeArtifactRepo(adapter, uploadImage);
  const saveUser = (u: AppUser) => setDoc(doc(db, 'users', u.uid), { name: u.name, email: u.email, role: u.role, updatedBy: uid(), updatedAt: serverTimestamp() });
  return {
    ...base,
    getImage: async (id: string) => String((await getDoc(doc(db, 'images', id))).data()?.data ?? ''),
    listUsers: async () => (await getDocs(collection(db, 'users'))).docs.map((d) => ({ ...(d.data() as Omit<AppUser, 'uid'>), uid: d.id })),
    saveUser,
    saveUserRole: (target: string, role: Role, name: string, email: string) => saveUser({ uid: target, role, name, email }),
    deleteUser: (target: string) => deleteDoc(doc(db, 'users', target)),
    /**
     * Creates a sign-in account without signing the admin out: the account is made
     * on a throwaway second app instance, then the role document is written as the admin.
     */
    async createUser(u: Omit<AppUser, 'uid'>, password: string): Promise<string> {
      if (!options) throw new Error('no firebase options');
      const tmp = initializeApp(options, `create-${Date.now()}`);
      try {
        const cred = await createUserWithEmailAndPassword(getAuth(tmp), u.email, password);
        await signOut(getAuth(tmp));
        await saveUser({ ...u, uid: cred.user.uid });
        return cred.user.uid;
      } finally {
        await deleteApp(tmp);
      }
    },
    /** Copies documents exported from the Claude artifact ({path, data}[]) into Firestore. */
    async importDocs(docs: { path: string; data: Record<string, unknown> }[], onProgress?: (done: number) => void) {
      let n = 0;
      for (const d of docs) {
        const { updatedAt: _a, updatedBy: _b, ...data } = d.data;
        await adapter.doc(d.path).set(data);
        onProgress?.(++n);
      }
    },
  };
}
