// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { ImportSection, LinesSection, SettersSection, SummarySection, UsersSection, WorkersSection } from '../../src/pages/Settings';
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
    await waitFor(() => expect(repo.saveSummary).toHaveBeenCalledWith({ month: '2026-03', per: 120, lotSent: 10, lotOut: 1, lotFg: null }));
    expect(repo.deleteSummary).toHaveBeenCalledWith('2026-01');
  });
});

describe('Settings users', () => {
  it('creates a viewer account with email and starting password', async () => {
    const repo = fakeRepo({});
    render(<RepoContext.Provider value={repo}><UsersSection /></RepoContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มผู้ใช้' }));
    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: 'สมชาย' } });
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'som@x.com' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่านเริ่มต้น'), { target: { value: '123' } });
    expect(screen.getByRole('alert')).toHaveTextContent('รหัสผ่านอย่างน้อย 6 ตัวอักษร');
    fireEvent.change(screen.getByLabelText('รหัสผ่านเริ่มต้น'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.createUser).toHaveBeenCalledWith({ name: 'สมชาย', email: 'som@x.com', role: 'viewer' }, '123456'));
  });
});

describe('Settings import', () => {
  it('reads an exported file and imports its documents', async () => {
    const repo = fakeRepo({});
    render(<RepoContext.Provider value={repo}><ImportSection /></RepoContext.Provider>);
    const docs = [{ path: 'lines/sl1', data: { name: 'SL1' } }, { path: 'lotMonth/2026-10', data: { days: {} } }, { path: 'users/x', data: { role: 'admin' } }];
    const file = new File([JSON.stringify(docs)], 'data.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('ไฟล์ข้อมูล'), { target: { files: [file] } });
    await waitFor(() => screen.getByText(/พบ 2 รายการ/));
    fireEvent.click(screen.getByRole('button', { name: 'นำเข้า' }));
    await waitFor(() => expect(repo.importDocs).toHaveBeenCalledWith(docs.slice(0, 2), expect.any(Function)));
  });
  it('lists the monthly production figures a file holds', async () => {
    render(<RepoContext.Provider value={fakeRepo({})}><ImportSection /></RepoContext.Provider>);
    const docs = [{ path: 'opsMonthly/2026-01', data: { month: '2026-01' } }, { path: 'opsMonthly/2026-02', data: { month: '2026-02' } }];
    fireEvent.change(screen.getByLabelText('ไฟล์ข้อมูล'), { target: { files: [new File([JSON.stringify(docs)], 'ops.json')] } });
    await waitFor(() => screen.getByText('พบ 2 รายการ: ยอดผลิตและต้นทุนการผลิต (เดือน) 2'));
  });
});

describe('Settings workers keep reports correct', () => {
  const workers = [{ id: 'w19', name: 'นายสุชาติ อาจโยคะ', active: true }, { id: 'w21', name: 'นายณัฐวุฒิ เดชธรรม', active: true }];
  it('a worker who has past records is set to not in use instead of deleted', async () => {
    const repo = fakeRepo({ workers, refs: { w19: { count: 5, first: '2026-11-02', last: '2026-11-20' } } });
    render(<RepoContext.Provider value={repo}><WorkersSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('ใช้งาน นายณัฐวุฒิ เดชธรรม'));
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'เลือกแถว' })[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'เลือกแถว' })[1]);
    fireEvent.click(screen.getByRole('button', { name: /ลบที่เลือก/ }));
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก/ }));
    await waitFor(() => expect(repo.deleteWorker).toHaveBeenCalledWith('w21'));
    expect(repo.deleteWorker).not.toHaveBeenCalledWith('w19');
    expect(repo.saveWorker).toHaveBeenCalledWith({ id: 'w19', name: 'นายสุชาติ อาจโยคะ', active: false });
    expect(await screen.findByText(/เปลี่ยนเป็น “ไม่ใช้งาน” แทนการลบ/)).toBeInTheDocument();
  });
  it('lists records of deleted workers and hands them to the chosen person', async () => {
    const repo = fakeRepo({ workers, refs: { w20: { count: 8, first: '2026-11-02', last: '2026-11-20' }, w19: { count: 3, first: '', last: '' } } });
    render(<RepoContext.Provider value={repo}><WorkersSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByText('w20'));
    expect(screen.queryByText('w19')).toBeNull();
    fireEvent.change(screen.getByLabelText('เป็นของ w20'), { target: { value: 'w19' } });
    fireEvent.click(screen.getByRole('button', { name: 'แก้ข้อมูล' }));
    await waitFor(() => expect(repo.replaceWorker).toHaveBeenCalledWith('w20', 'w19'));
  });
});
