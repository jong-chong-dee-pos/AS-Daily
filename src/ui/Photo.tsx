import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';

const IMG_PREFIX = 'fsimg:';
const cache = new Map<string, Promise<string>>();

/** Thumbnail that opens full size; resolves photos stored in Firestore (fsimg:id) on demand. */
export function Photo({ src, alt }: { src: string; alt: string }) {
  const repo = useRepo();
  const stored = src.startsWith(IMG_PREFIX);
  const [url, setUrl] = useState(stored ? '' : src);
  useEffect(() => {
    if (!stored || !repo.getImage) return;
    const id = src.slice(IMG_PREFIX.length);
    if (!cache.has(id)) cache.set(id, repo.getImage(id));
    let live = true;
    cache.get(id)!.then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [src, stored, repo]);
  const open = (e: React.MouseEvent) => {
    if (!url.startsWith('data:')) return;
    e.preventDefault();
    // Browsers block opening data: URLs directly; show it in a new tab as an <img>.
    const w = window.open('', '_blank');
    if (!w) return;
    const img = w.document.createElement('img');
    img.src = url; img.style.maxWidth = '100%';
    w.document.body.appendChild(img);
  };
  return <a href={url || undefined} target="_blank" rel="noreferrer" onClick={open}>{url ? <img src={url} alt={alt} /> : <span className="hint">…</span>}</a>;
}
