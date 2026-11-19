// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { LinesSection, SettersSection, SummarySection, WorkersSection } from '../../src/pages/Settings';
import { fakeRepo, L } from './fakeRepo';

describe('Settings lines', () => {
  it('saves only changed lines, with include and active flags', async () => {
    const repo = fakeRepo({ lines: [L('sl1', 'A'), L('sl2', 'A')] });
    render(<RepoContext.Provider value={repo}><LinesSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('ใช้งาน SL2'));
    fireEvent.click(screen.getByLabelText('ใช้งาน SL2'));
    fireEvent.click(screen.getByLabelText('นับเข้าค่ารวม SL2'));
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.saveLine).toHaveBeenCalledTimes(1));
    expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl2', active: false, includeInTotal: false }));
  });
  it('blocks saving a new line without code and setter', async () => {
    const repo = fakeRepo({ lines: [] });
    render(<RepoContext.Provider value={repo}><LinesSection /></RepoContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม U-Line' }));
    expect(screen.getByRole('alert')).toHaveTextContent('กรอกชื่อ U-Line และเลือก Setter ให้ครบ');
    expect(screen.getByRole('button', { name: /^บันทึก/ })).toBeDisabled();
  });
  it('deletes ticked lines on save', async () => {
    const repo = fakeRepo({ lines: [L('sl1', 'A'), L('sl2', 'A')] });
    render(<RepoContext.Provider value={repo}><LinesSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('ใช้งาน SL2'));
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'เลือกแถว' })[1]);
    fireEvent.click(screen.getByRole('button', { name: /ลบที่เลือก/ }));
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.deleteLine).toHaveBeenCalledWith('sl2'));
    expect(repo.saveLine).not.toHaveBeenCalled();
  });
});

describe('Settings setters, workers, summaries', () => {
  it('moves a line to the setter who ticks it and renames setters on their lines', async () => {
    const repo = fakeRepo({ lines: [L('sl1', 'A'), L('sl2', 'B')], setters: [{ id: 's1', name: 'A', order: 1 }, { id: 's2', name: 'B', order: 2 }] });
    render(<RepoContext.Provider value={repo}><SettersSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('A ดูแล SL2'));
    fireEvent.click(screen.getByLabelText('A ดูแล SL2'));
    fireEvent.change(screen.getAllByLabelText('ชื่อ Setter')[0], { target: { value: 'A2' } });
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.saveSetter).toHaveBeenCalledWith({ id: 's1', name: 'A2', order: 1 }));
    expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl1', setter: 'A2' }));
    expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl2', setter: 'A2' }));
  });
  it('assigns a worker to one U-Line, removing them from the old one', async () => {
    const repo = fakeRepo({ lines: [L('sl1', 'A', { defaultWorkerIds: ['w1'] }), L('sl2', 'A')], workers: [{ id: 'w1', name: 'สมชาย', active: true }] });
    render(<RepoContext.Provider value={repo}><WorkersSection /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('U-Line ประจำ สมชาย')).toHaveValue('sl1'));
    fireEvent.change(screen.getByLabelText('U-Line ประจำ สมชาย'), { target: { value: 'sl2' } });
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl2', defaultWorkerIds: ['w1'] })));
    expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl1', defaultWorkerIds: [] }));
  });
  it('moves a summary to another month picked from the lists', async () => {
    const repo = fakeRepo({ summaries: [{ month: '2026-01', per: 120, lotSent: 10, lotOut: 1 }] });
    render(<RepoContext.Provider value={repo}><SummarySection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('เดือน 2026-01'));
    fireEvent.change(screen.getByLabelText('เดือน 2026-01'), { target: { value: '03' } });
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.saveSummary).toHaveBeenCalledWith({ month: '2026-03', per: 120, lotSent: 10, lotOut: 1 }));
    expect(repo.deleteSummary).toHaveBeenCalledWith('2026-01');
  });
});
