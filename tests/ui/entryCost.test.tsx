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
    await waitFor(() => expect(screen.getByLabelText('Electric Standard')).toHaveValue('26548.43'));
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
    await waitFor(() => expect(screen.getByLabelText('Electric Standard')).toHaveValue('26548.43'));
    fireEvent.change(screen.getByLabelText('หมายเหตุ Electric'), { target: { value: 'แอร์เสีย' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveCostMonth).toHaveBeenCalledWith(expect.objectContaining({ note: { electric: 'แอร์เสีย' } })));
  });
  it('saves production figures with the month and shows the computed per-piece values', async () => {
    const repo = fakeRepo();
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-01" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    const type = (l: string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    type('ยอดผลิต PLAN (PN)', '76,580'); type('ยอดผลิต ACTUAL (AS)', '84761');
    type('Actual Process Cost', '605521'); type('จำนวนคน', '60'); type('Expense รวม', '424000');
    expect(screen.getByTestId('calc-process')).toHaveTextContent('7.14');
    expect(screen.getByTestId('calc-head')).toHaveTextContent('1,413');
    expect(screen.getByTestId('calc-expense')).toHaveTextContent('5.00');
    expect(screen.getByTestId('calc-prod')).toHaveTextContent('+8,181');
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveOpsMonth).toHaveBeenCalledWith({ month: '2026-01', prodPlan: 76580, prodActual: 84761, matStd: null, matAct: null,
      processCost: 605521, headcount: 60, expense: 424000, prodForHead: null }));
    expect(repo.saveCostMonth).toHaveBeenCalled();
  });
  it('loads saved production figures; a month with none saves no production record', async () => {
    const repo = fakeRepo({ ops: [{ month: '2026-10', prodPlan: 71725, prodActual: 71031, matStd: 47.6, matAct: 47.51, processCost: 745731, headcount: 60, expense: null }] });
    render(<RepoContext.Provider value={repo}><EntryCost initialMonth="2026-10" /></RepoContext.Provider>);
    await waitFor(() => expect(screen.getByLabelText('ยอดผลิต ACTUAL (AS)')).toHaveValue('71031'));
    expect(screen.getByTestId('calc-mat')).toHaveTextContent('0.09');
    fireEvent.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    await waitFor(() => expect(screen.getByLabelText('ยอดผลิต ACTUAL (AS)')).toHaveValue(''));
    fireEvent.change(screen.getByLabelText('Electric Standard'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(repo.saveCostMonth).toHaveBeenCalled());
    expect(repo.saveOpsMonth).not.toHaveBeenCalled();
  });
});
