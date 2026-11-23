// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepoContext } from '../../src/data/RepoContext';
import { LotFgDetail } from '../../src/pages/LotFgDetail';
import { monthlySentFg } from '../../src/calc/monthly';
import { fakeRepo, L } from './fakeRepo';

describe('Lot out FG', () => {
  it('uses daily FG counts, else the summary FG, else the imported monthly Lot out (FG in the Excel sheet)', () => {
    const r = monthlySentFg(['2026-09', '2026-10', '2026-11'],
      [{ date: '2026-11-03', sent: 20, patrol: 1, fg: 2 }],
      [{ month: '2026-09', per: null, lotSent: 500, lotOut: 3, lotFg: 1 }, { month: '2026-10', per: null, lotSent: 600, lotOut: 4 }]);
    expect(r.map((x) => [x.sent, x.fg])).toEqual([[500, 1], [600, 4], [20, 2]]);
  });
  it('lists only FG items of the month with line, product and problem', async () => {
    const repo = fakeRepo({
      lines: [L('sl1', 'A')],
      lot: [{ date: '2026-11-03', sent: 20, patrol: 1, fg: 2, items: [
        { id: 'a', partNo: 'P-1', product: 'Sensor X', lineId: 'sl1', kind: 'fg', note: 'ขาหัก', images: ['https://img/1.png'] },
        { id: 'b', partNo: 'P-2', kind: 'patrol', note: 'รอย', images: [] },
      ] }],
    });
    render(<MemoryRouter initialEntries={['/report/lot/fg?m=2026-11']}><RepoContext.Provider value={repo}><LotFgDetail /></RepoContext.Provider></MemoryRouter>);
    await waitFor(() => screen.getByText('Sensor X'));
    expect(screen.getByText('SL1')).toBeInTheDocument();
    expect(screen.getByText('ขาหัก')).toBeInTheDocument();
    expect(screen.queryByText('รอย')).toBeNull();
    expect(screen.getByTestId('fg-count')).toHaveTextContent('2');
    expect(screen.getByText('ยังขาดรายละเอียด 1 รายการ')).toBeInTheDocument();
  });
});
