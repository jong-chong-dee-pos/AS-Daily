// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { grouped, NumInput, useEnterMovesDown, useUnsavedGuard } from '../../src/ui/entryKit';
import { parseNum } from '../../src/pages/EntryDaily';

describe('number entry with thousands separators', () => {
  it('groups the whole part and keeps what follows the point', () => {
    expect(grouped('1234567')).toBe('1,234,567');
    expect(grouped('1234.5')).toBe('1,234.5');
    expect(grouped('1234.')).toBe('1,234.');
    expect(grouped('12,34')).toBe('1,234');
    expect(grouped('')).toBe('');
    expect(grouped('12a')).toBe('12a'); // left alone so the page marks it invalid
    expect(parseNum(grouped('9876543.21'))).toBe(9876543.21);
  });

  it('writes the commas while typing', () => {
    function Box() { const [v, setV] = useState(''); return <NumInput aria-label="n" value={v} onChange={(e) => setV(e.target.value)} />; }
    render(<Box />);
    const el = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.change(el, { target: { value: '71725' } });
    expect(el.value).toBe('71,725');
  });
});

describe('Enter moves down', () => {
  function Grid() {
    const ref = useRef<HTMLDivElement>(null);
    useEnterMovesDown(ref);
    return (
      <div ref={ref}>
        <table><tbody>
          <tr><td><input aria-label="a1" /></td><td><input aria-label="b1" /></td></tr>
          <tr><td><input aria-label="a2" /></td><td><input aria-label="b2" /></td></tr>
        </tbody></table>
        <input aria-label="after" />
      </div>
    );
  }
  it('goes to the cell below in a table, then on to the next field', () => {
    render(<Grid />);
    screen.getByLabelText('b1').focus();
    fireEvent.keyDown(screen.getByLabelText('b1'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('b2'));
    fireEvent.keyDown(screen.getByLabelText('b2'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('after'));
  });
});

describe('unsaved changes', () => {
  function Page({ dirty }: { dirty: boolean }) { useUnsavedGuard(dirty); return <a href="#/elsewhere">ไปหน้าอื่น</a>; }
  it('asks before a link leaves the page, and lets it go when nothing is pending', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { rerender } = render(<Page dirty />);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    screen.getByText('ไปหน้าอื่น').dispatchEvent(ev);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
    rerender(<Page dirty={false} />);
    const ev2 = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    screen.getByText('ไปหน้าอื่น').dispatchEvent(ev2);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
  it('asks the browser before the tab closes', () => {
    const { unmount } = render(<Page dirty />);
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    unmount();
  });
});
