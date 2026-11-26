// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../src/firebase', () => ({ auth: {}, db: {} }));
import { AuthContext } from '../../src/auth/AuthProvider';
import { Layout } from '../../src/ui/Layout';
import { FilterBar } from '../../src/ui/FilterBar';
import type { Role } from '../../src/types';

const renderAs = (role: Role) => render(
  <AuthContext.Provider value={{ user: { uid: 'u', name: 'n', email: 'e', role }, noRole: false, loading: false, signOut: async () => {} }}>
    <MemoryRouter><Routes><Route path="*" element={<Layout />} /></Routes></MemoryRouter>
  </AuthContext.Provider>,
);

describe('Layout', () => {
  it('viewer sees reports only', () => {
    renderAs('viewer');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('ข้อมูลรายวัน')).toBeNull();
    expect(screen.queryByText('ตั้งค่า')).toBeNull();
  });
  it('editor sees entry but not settings', () => {
    renderAs('editor');
    expect(screen.getByText('ข้อมูลรายวัน')).toBeInTheDocument();
    expect(screen.queryByText('ตั้งค่า')).toBeNull();
  });
  it('admin sees settings', () => {
    renderAs('admin');
    expect(screen.getByText('ตั้งค่า')).toBeInTheDocument();
  });
});

describe('FilterBar', () => {
  it('rejects a range whose start is after its end', () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ kind: 'month', month: '2026-11' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ช่วงวันที่' }));
    fireEvent.change(screen.getByLabelText('จาก'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('ถึง'), { target: { value: '2026-11-10' } });
    expect(screen.getByRole('alert')).toHaveTextContent('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
    expect(onChange).not.toHaveBeenCalledWith({ kind: 'range', from: '2026-11-20', to: '2026-11-10' });
  });
  it('choosing a date range starts from the month on screen', () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ kind: 'month', month: '2026-02' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ช่วงวันที่' }));
    expect(onChange).toHaveBeenCalledWith({ kind: 'range', from: '2026-02-01', to: '2026-02-28' });
    expect(screen.getByLabelText('จาก')).toHaveValue('2026-02-01');
    expect(screen.getByLabelText('ถึง')).toHaveValue('2026-02-28');
  });
  it('shows the dates of a range that comes from the address bar', () => {
    const { rerender } = render(<FilterBar value={{ kind: 'month', month: '2026-11' }} onChange={() => {}} />);
    rerender(<FilterBar value={{ kind: 'range', from: '2026-10-20', to: '2026-11-10' }} onChange={() => {}} />);
    expect(screen.getByLabelText('จาก')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('ถึง')).toHaveValue('2026-11-10');
  });
  it('switching month emits a month period', () => {
    const onChange = vi.fn();
    render(<FilterBar value={{ kind: 'month', month: '2026-11' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('เดือน'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith({ kind: 'month', month: '2026-03' });
  });
});
