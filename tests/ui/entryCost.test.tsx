// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { EntryCost } from '../../src/pages/EntryCost';
import { fakeRepo } from './fakeRepo';

const oct = {
  month: '2026-10',
  standard: { electric: 26548.43, laborOT: 90861.99, laborSub: 342137.71, consumed: 193173.06 },
  actual: { electric: 54594.25, laborOT: 99186.96, laborSub: 377396.89, consumed: 215264.22 },
};

describe('EntryCost', () => {
  it('loads a month and shows live variance', async () => {
    render(<RepoContext.Provider value={fakeRepo({ cost: [oct] })}><EntryCost initialMonth="2026-10" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('Electric Standard')).toHaveValue('26,548.43'));
    expect(screen.getByTestId('var-electric')).toHaveTextContent('-28,046');
    expect(screen.getByTestId('var-electric')).toHaveClass('neg');
    fireEvent.change(screen.getByLabelText('Electric Actual'), { target: { value: '20000' } });
    expect(screen.getByTestId('var-electric')).toHaveTextContent('6,548');
  });
  it('saves all four categories', async () => {
    const repo = fakeRepo();
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-11" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Consumed Standard'), { target: { value: '1,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveCostMonth).toHaveBeenCalledWith({
      month: '2026-11',
      standard: { electric: null, laborOT: null, laborSub: null, consumed: 1000 },
      actual: { electric: null, laborOT: null, laborSub: null, consumed: null },
    }));
  });
  it('saves a note next to the category', async () => {
    const repo = fakeRepo({ cost: [oct] });
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-10" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('Electric Standard')).toHaveValue('26,548.43'));
    fireEvent.change(screen.getByLabelText('หมายเหตุ Electric'), { target: { value: 'แอร์เสีย' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveCostMonth).toHaveBeenCalledWith(expect.objectContaining({ note: { electric: 'แอร์เสีย' } })));
  });
  it('saves production figures with the month and shows the computed per-piece values', async () => {
    const repo = fakeRepo();
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-01" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    const type = (l: string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    type('ยอดผลิต PLAN (PN)', '10,000'); type('ยอดผลิต ACTUAL (AS)', '9000');
    type('Actual Process Cost', '72000'); type('จำนวนคน', '8'); type('Expense รวม', '45000');
    expect(screen.getByTestId('calc-process')).toHaveTextContent('8.00');
    expect(screen.getByTestId('calc-head')).toHaveTextContent('1,125');
    expect(screen.getByTestId('calc-expense')).toHaveTextContent('5.00');
    expect(screen.getByTestId('calc-prod')).toHaveTextContent('-1,000');
    type('ยอดผลิต (Process)', '9600');
    expect(screen.getByTestId('calc-process')).toHaveTextContent('7.50');
    expect(screen.getByTestId('calc-head')).toHaveTextContent('1,125');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveOpsMonth).toHaveBeenCalledWith({ month: '2026-01', prodPlan: 10000, prodActual: 9000, matStd: null, matAct: null,
      processCost: 72000, headcount: 8, expense: 45000, prodForCost: 9600, prodForHead: null }));
    expect(repo.saveCostMonth).toHaveBeenCalled();
  });
  it('loads saved production figures; a month with none saves no production record', async () => {
    const repo = fakeRepo({ ops: [{ month: '2026-10', prodPlan: 12000, prodActual: 11500, matStd: 40, matAct: 39.91, processCost: 90000, headcount: 9, expense: null }] });
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-10" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('ยอดผลิต ACTUAL (AS)')).toHaveValue('11,500'));
    expect(screen.getByTestId('calc-mat')).toHaveTextContent('0.09');
    fireEvent.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await waitFor(() => expect(screen.getByLabelText('ยอดผลิต ACTUAL (AS)')).toHaveValue(''));
    fireEvent.change(screen.getByLabelText('Electric Standard'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveCostMonth).toHaveBeenCalled());
    expect(repo.saveOpsMonth).not.toHaveBeenCalled();
  });
  it('saves the chart notes with the month and loads them again', async () => {
    const repo = fakeRepo({ ops: [{ month: '2026-03', prodPlan: 5, prodActual: 5, matStd: null, matAct: null, processCost: null, headcount: null, expense: null, notes: { mat: 'ราคาขึ้น' } }] });
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-03" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('หมายเหตุ Material cost')).toHaveValue('ราคาขึ้น'));
    const type = (l: string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    type('หมายเหตุ Production Volume', 'หยุดยาว'); type('หมายเหตุ % PER', 'ไลน์ใหม่'); type('หมายเหตุ Lot out', ' ');
    type('หมายเหตุ %OTD', 'ส่งช้า'); type('หมายเหตุ Material cost', '');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveOpsMonth).toHaveBeenCalledWith(expect.objectContaining({ month: '2026-03', notes: { per: 'ไลน์ใหม่', prod: 'หยุดยาว', otd: 'ส่งช้า' } })));
  });
  it('a note alone is enough to keep the month', async () => {
    const repo = fakeRepo();
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-02" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('หมายเหตุ Lot out'), { target: { value: 'งานด่วน' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveOpsMonth).toHaveBeenCalledWith(expect.objectContaining({ notes: { lot: 'งานด่วน' } })));
  });
});

