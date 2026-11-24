// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { OtdUpload } from '../../src/pages/OtdUpload';
import { fakeRepo } from './fakeRepo';
import { otdWorkbook } from '../import/otdFixture';

describe('%OTD upload', () => {
  it('reads the file, shows the month and saves only after confirming', async () => {
    const repo = fakeRepo();
    render(<RepoContext.Provider value={repo}><OtdUpload /></RepoContext.Provider>);
    const file = new File([await otdWorkbook()], 'Plan Week NOV26.xlsx');
    fireEvent.change(screen.getByLabelText('ไฟล์ %OTD'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText('เดือนของ %OTD')).toHaveValue('2026-11'), { timeout: 10000 });
    expect(screen.getByText('63%')).toBeInTheDocument();
    expect(screen.getByText(/W1–W4: 95% \/ 95% \/ 80% \/ 30%/)).toBeInTheDocument();
    expect(repo.saveOtdUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /บันทึก %OTD เดือน/ }));
    await waitFor(() => expect(repo.saveOtdUpload).toHaveBeenCalled());
    const [rec, hist] = repo.saveOtdUpload.mock.calls[0];
    expect(rec).toMatchObject({ month: '2026-11', source: 'upload', updated: '2026-11-24' });
    expect(hist.map((h: { month: string }) => h.month)).toEqual(['2024-12', '2025-12', '2026-01', '2026-02']);
    expect(await screen.findByText(/บันทึก %OTD เดือน .* แล้ว และเติม %OTD รายเดือนย้อนหลัง 4 เดือน/)).toBeInTheDocument();
  }, 20000);
  it('explains a file without the OTD sheet', async () => {
    render(<RepoContext.Provider value={fakeRepo()}><OtdUpload /></RepoContext.Provider>);
    fireEvent.change(screen.getByLabelText('ไฟล์ %OTD'), { target: { files: [new File(['not excel'], 'x.xlsx')] } });
    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent(/อ่านไฟล์ไม่ได้|ไม่พบชีต/);
  }, 20000);
});
