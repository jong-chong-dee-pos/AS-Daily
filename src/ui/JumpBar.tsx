import { useEffect, useRef, useState } from 'react';

export interface JumpItem { id: string; label: string }

const matches = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

/** On phones the menu bar sits stuck to the top of the screen, so the shortcut bar goes under it. */
const headerHeight = () => {
  const bar = document.querySelector<HTMLElement>('.sidebar');
  return bar && matches('(max-width: 860px)') ? bar.offsetHeight : 0;
};

/**
 * A bar of shortcuts that stays at the top while a long dashboard scrolls. Tapping one scrolls to that
 * section; the section on screen is highlighted.
 */
export function JumpBar({ items }: { items: JumpItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(0);
  const [current, setCurrent] = useState(items[0]?.id);

  useEffect(() => {
    const onResize = () => setTop(headerHeight());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = headerHeight() + (ref.current?.offsetHeight ?? 0) + 24;
        let at = items[0]?.id;
        for (const it of items) {
          const el = document.getElementById(it.id);
          if (el && el.getBoundingClientRect().top <= line) at = it.id;
        }
        // At the very bottom the last short section can never reach the line: count it as reached.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) at = items[items.length - 1]?.id;
        setCurrent(at);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [items]);

  // Keep the highlighted shortcut visible when the bar scrolls sideways on a phone.
  useEffect(() => {
    const btn = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const bar = ref.current;
    if (btn && bar && bar.scrollWidth > bar.clientWidth && bar.scrollTo) bar.scrollTo({ left: btn.offsetLeft - 16 });
  }, [current]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - headerHeight() - (ref.current?.offsetHeight ?? 0) - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: matches('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' });
    setCurrent(id);
  };

  return (
    <nav ref={ref} className="jumpbar" aria-label="ไปที่หัวข้อ" style={{ top }}>
      {items.map((it) => (
        <button key={it.id} type="button" aria-current={current === it.id ? 'true' : undefined} onClick={() => go(it.id)}>{it.label}</button>
      ))}
    </nav>
  );
}
