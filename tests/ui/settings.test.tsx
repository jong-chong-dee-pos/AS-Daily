// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RepoContext } from '../../src/data/RepoContext';
import { LinesSection } from '../../src/pages/Settings';
import { fakeRepo, L } from './fakeRepo';

describe('Settings lines', () => {
  it('saves only changed lines, with include and active flags', async () => {
    const repo = fakeRepo({ lines: [L('sl1', 'A'), L('sl2', 'A')] });
    render(<RepoContext.Provider value={repo}><LinesSection /></RepoContext.Provider>);
    await waitFor(() => screen.getByLabelText('ใช้งาน SL2'));
    fireEvent.click(screen.getByLabelText('ใช้งาน SL2'));
    fireEvent.click(screen.getByLabelText('นับเข้าค่ารวม SL2'));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกไลน์' }));
    await waitFor(() => expect(repo.saveLine).toHaveBeenCalledTimes(1));
    expect(repo.saveLine).toHaveBeenCalledWith(expect.objectContaining({ id: 'sl2', active: false, includeInTotal: false }));
  });
  it('blocks saving a new line without code and setter', async () => {
    const repo = fakeRepo({ lines: [] });
    render(<RepoContext.Provider value={repo}><LinesSection /></RepoContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มไลน์' }));
    expect(screen.getByRole('alert')).toHaveTextContent('กรอกรหัสไลน์และ Setter ให้ครบ');
    expect(screen.getByRole('button', { name: 'บันทึกไลน์' })).toBeDisabled();
  });
});
