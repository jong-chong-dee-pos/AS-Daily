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
});
