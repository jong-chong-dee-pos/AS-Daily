// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { EntryDaily } from '../../src/pages/EntryDaily';
import { fakeRepo, L } from './fakeRepo';

const data = {
  lines: [L('sl1', 'A', { defaultWorkerIds: ['w1'] }), L('sl2', 'A', { defaultWorkerIds: ['w2'] })],
  workers: [{ id: 'w1', name: 'สมชาย', active: true }, { id: 'w2', name: 'สมหญิง', active: true }, { id: 'w3', name: 'สมศรี', active: true }],
  per: [{ date: '2026-11-03', lineId: 'sl2', workerIds: ['w3'], per: 140 }],
};
const setup = (date: string) => {
  const repo = fakeRepo(data);
  render(<RepoContext.Provider value={repo}><EntryDaily initialDate={date} /></RepoContext.Provider>);
  return repo;
};

describe('EntryDaily', () => {
  it('pre-fills default workers for a new day', async () => {
    setup('2026-11-04');
    await waitFor(() => expect(screen.getAllByLabelText('พนักงาน 1')[0]).toHaveValue('w1'));
    expect(screen.getAllByLabelText('พนักงาน 1')[1]).toHaveValue('w2');
  });
  it('loads recorded workers and values for an existing day', async () => {
    setup('2026-11-03');
    await waitFor(() => expect(screen.getByLabelText('% PER SL2')).toHaveValue('140'));
    expect(screen.getAllByLabelText('พนักงาน 1')[1]).toHaveValue('w3');
  });
  it('rejects text and negatives', async () => {
    setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('% PER SL1'));
    fireEvent.change(screen.getByLabelText('% PER SL1'), { target: { value: 'abc' } });
    expect(screen.getByRole('alert')).toHaveTextContent('กรอกตัวเลข 0 ขึ้นไป');
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('% PER SL1'), { target: { value: '-5' } });
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
  });
  it('rejects more lot out than lots sent', async () => {
    setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('Lot ส่งตรวจ'));
    fireEvent.change(screen.getByLabelText('Lot ส่งตรวจ'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Lot out FG'), { target: { value: '2' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Lot out มากกว่า Lot ส่งตรวจ');
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
  });
  it('saves per rows and the lot day once each', async () => {
    const repo = setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('% PER SL1'));
    fireEvent.change(screen.getByLabelText('% PER SL1'), { target: { value: '125.5' } });
    fireEvent.change(screen.getByLabelText('Lot ส่งตรวจ'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Lot out Patrol'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('บันทึกข้อมูลวันที่ 04/11/2026 แล้ว'));
    expect(repo.savePerDay).toHaveBeenCalledTimes(1);
    expect(repo.savePerDay).toHaveBeenCalledWith('2026-11-04', [
      { date: '2026-11-04', lineId: 'sl1', workerIds: ['w1'], per: 125.5 },
      { date: '2026-11-04', lineId: 'sl2', workerIds: ['w2'], per: null },
    ]);
    expect(repo.saveLotDay).toHaveBeenCalledWith({ date: '2026-11-04', sent: 20, patrol: 1, fg: 0, items: [] });
  });
  it('asks for Lot out details when Lot out was counted', async () => {
    setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('Lot out FG'));
    expect(screen.getByText('วันนี้ไม่มี Lot out')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lot ส่งตรวจ'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Lot out FG'), { target: { value: '2' } });
    expect(screen.getByText(/มี Lot out 2 Lot ยังไม่ได้บันทึกรายละเอียด/)).toBeInTheDocument();
  });
  it('keeps a recorded worker who is no longer in use', async () => {
    const repo = fakeRepo({ ...data, workers: data.workers.map((w) => (w.id === 'w3' ? { ...w, active: false } : w)) });
    render(<RepoContext.Provider value={repo}><EntryDaily initialDate="2026-11-03" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getAllByLabelText('พนักงาน 1')[1]).toHaveValue('w3'));
    expect(screen.getAllByRole('option', { name: 'สมศรี (ไม่ใช้งาน)' }).length).toBeGreaterThan(0);
  });
  it('records the leave type and its reason; "other" needs a reason', async () => {
    const repo = setup('2026-11-04');
    await waitFor(() => screen.getByRole('button', { name: '+ เพิ่มคนที่ไม่มา' }));
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มคนที่ไม่มา' }));
    const type = screen.getByLabelText('ประเภทการลา');
    expect([...type.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'อื่นๆ', 'ขาดงาน']);
    fireEvent.change(screen.getByLabelText('พนักงานที่ไม่มา'), { target: { value: 'w2' } });
    fireEvent.change(type, { target: { value: 'other' } });
    expect(screen.getByRole('alert')).toHaveTextContent('ประเภท “อื่นๆ” ต้องระบุสาเหตุ');
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('สาเหตุการลา'), { target: { value: 'งานศพญาติ' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveAbsenceDay).toHaveBeenCalledWith('2026-11-04', [{ workerId: 'w2', reason: 'other', note: 'งานศพญาติ' }]));
  });
  it('reads an old "ลา" record by the type in its note', async () => {
    const repo = fakeRepo({ ...data, absences: [{ date: '2026-11-03', list: [
      { workerId: 'w1', reason: 'leave', note: 'ลาป่วย ไข้หวัด' }, { workerId: 'w2', reason: 'leave', note: '' }, { workerId: 'w3', reason: 'absent', note: '' }] }] });
    render(<RepoContext.Provider value={repo}><EntryDaily initialDate="2026-11-03" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getAllByLabelText('ประเภทการลา')).toHaveLength(3));
    const types = screen.getAllByLabelText('ประเภทการลา') as HTMLSelectElement[];
    expect(types.map((t) => t.selectedOptions[0].textContent)).toEqual(['ลาป่วย', 'ลา (ไม่ระบุประเภท)', 'ขาดงาน']);
    expect(screen.getAllByLabelText('สาเหตุการลา')[0]).toHaveValue('ไข้หวัด');
  });
  it('asks for the Product name before the Part No.', async () => {
    setup('2026-11-04');
    await waitFor(() => screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    const product = screen.getByLabelText('ชื่อ Product'), part = screen.getByLabelText('Part No.');
    expect(product.compareDocumentPosition(part) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('keeps a note for each worker next to % PER and shows it again', async () => {
    const repo = setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('% PER SL1'));
    expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 2')).toBeDisabled(); // nobody in slot 2 yet
    fireEvent.change(screen.getAllByLabelText('พนักงาน 2')[0], { target: { value: 'w3' } });
    fireEvent.change(screen.getByLabelText('% PER SL1'), { target: { value: '130' } });
    fireEvent.change(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 2'), { target: { value: 'มาช่วยครึ่งวัน ' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.savePerDay).toHaveBeenCalled());
    expect(repo.savePerDay).toHaveBeenCalledWith('2026-11-04', [
      { date: '2026-11-04', lineId: 'sl1', workerIds: ['w1', 'w3'], per: 130, notes: ['', 'มาช่วยครึ่งวัน'] },
      { date: '2026-11-04', lineId: 'sl2', workerIds: ['w2'], per: null },
    ]);
  });
  it('loads saved notes and moves a note with its worker', async () => {
    const repo = fakeRepo({ ...data, per: [{ date: '2026-11-03', lineId: 'sl1', workerIds: ['w1', 'w3'], per: 120, notes: ['ออกก่อน 15:00', 'ช่วยงาน'] }] });
    render(<RepoContext.Provider value={repo}><EntryDaily initialDate="2026-11-03" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 1')).toHaveValue('ออกก่อน 15:00'));
    expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 2')).toHaveValue('ช่วยงาน');
    fireEvent.change(screen.getAllByLabelText('พนักงาน 1')[0], { target: { value: '' } }); // worker 1 removed
    expect(screen.getAllByLabelText('พนักงาน 2')[0]).toHaveValue('w3');
    expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 1')).toHaveValue(''); // the note left with w1
    expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 2')).toHaveValue('ช่วยงาน');
    fireEvent.change(screen.getAllByLabelText('พนักงาน 2')[0], { target: { value: 'w2' } }); // someone else
    expect(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 2')).toHaveValue('');
  });
  it('a note needs the line % PER so it is not lost', async () => {
    setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('หมายเหตุ SL1 พนักงาน 1'));
    fireEvent.change(screen.getByLabelText('หมายเหตุ SL1 พนักงาน 1'), { target: { value: 'ลาครึ่งวัน' } });
    expect(screen.getByRole('alert')).toHaveTextContent('ไลน์ SL1 มีหมายเหตุแต่ยังไม่ได้กรอก % PER');
    expect(screen.getByRole('button', { name: 'บันทึก' })).toBeDisabled();
  });
  it('saves a note for the day\'s Lot out and loads it again', async () => {
    const repo = setup('2026-11-04');
    await waitFor(() => screen.getByLabelText('Lot ส่งตรวจ'));
    fireEvent.change(screen.getByLabelText('Lot ส่งตรวจ'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('หมายเหตุ Lot out'), { target: { value: ' เครื่องเสีย ' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveLotDay).toHaveBeenCalledWith({ date: '2026-11-04', sent: 10, patrol: 0, fg: 0, items: [], note: 'เครื่องเสีย' }));
  });
  it('shows a saved Lot out note', async () => {
    const repo = fakeRepo({ ...data, lot: [{ date: '2026-11-05', sent: 5, patrol: 0, fg: 0, items: [], note: 'งานด่วน' }] });
    render(<RepoContext.Provider value={repo}><EntryDaily initialDate="2026-11-05" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('หมายเหตุ Lot out')).toHaveValue('งานด่วน'));
  });
});
