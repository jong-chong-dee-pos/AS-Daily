import { describe, expect, it } from 'vitest';
import { weekOf } from '../../src/calc/weeks';
import { datesIn, monthsIn } from '../../src/calc/period';
import { lineAverage, setterAverage, overallAverage, personAverage } from '../../src/calc/per';
import { lotTotals, lotByWeek } from '../../src/calc/lotout';
import { variance, targetFor } from '../../src/calc/cost';
import type { Line, PerEntry, LotEntry } from '../../src/types';

const line = (id: string, setter: string, includeInTotal = false): Line => ({
  id, code: id, order: 0, setter, defaultWorkerIds: [], includeInTotal, active: true,
});
const rows = (lineId: string, values: (number | null)[], workerIds: string[] = []): PerEntry[] =>
  values.flatMap((v, i) =>
    v === null ? [] : [{ date: `2026-11-${String(i + 1).padStart(2, '0')}`, lineId, workerIds, per: v }]);

describe('weekOf', () => {
  it('buckets by day of month', () => {
    expect(weekOf('2026-11-07')).toBe(1);
    expect(weekOf('2026-11-08')).toBe(2);
    expect(weekOf('2026-11-21')).toBe(3);
    expect(weekOf('2026-11-30')).toBe(4);
    expect(weekOf('2026-12-31')).toBe(4);
  });
});

describe('period', () => {
  it('range across years', () => {
    const p = { kind: 'range' as const, from: '2026-12-25', to: '2027-01-05' };
    expect(datesIn(p)).toHaveLength(12);
    expect(monthsIn(p)).toEqual(['2026-12', '2027-01']);
  });
  it('month and year', () => {
    expect(datesIn({ kind: 'month', month: '2026-02' })).toHaveLength(28);
    expect(monthsIn({ kind: 'year', year: 2026 })).toHaveLength(12);
  });
});

describe('% PER', () => {
  // Excel "% Per (Nov_26)." days 1–6
  const nov: PerEntry[] = [
    ...rows('SL2', [null, 153, 157, 144, 138, 144, 135].slice(1)),
    ...rows('SL4', [135, 104, 120, 97, 101, 100]),
    ...rows('SL6', [151, 152, 151, null, 156, 151]),
    ...rows('SL7', [null, null, 70, 150, 150, 72]),
    ...rows('SL9', [105, 115, 116, 111, 113, 123]),
    ...rows('AUTO-FV', [130, 154, null, 100, 133, 179]),
    ...rows('FV3', [142, 142, 142, null, 152, 135]),
    ...rows('SKIN', [170, 212, 213, 170, 170, 130]),
    ...rows('Sensor', [117, 140, 84, 177, 114, 89]),
    ...rows('AUTO2', [174, 174, 176, 178, 195, 180]),
  ];
  const lines = [
    line('SL4', 'A', true), line('SL5', 'A'), line('SL6', 'A', true),
    ...['SL7', 'SL9', 'AUTO-FV', 'FV3', 'SKIN', 'Sensor', 'AUTO2'].map((id) => line(id, 'X', true)),
    line('SL2', 'B'),
  ];

  it('line average ignores blank days', () => {
    expect(lineAverage(nov, 'SL2')).toBeCloseTo(145.1667, 3);
    expect(lineAverage(nov, 'SL5')).toBeNull();
  });
  it('setter average skips lines with no data (Excel E6)', () => {
    expect(setterAverage(nov, lines, 'A')).toBeCloseTo(130.85, 3);
  });
  it('overall average uses included lines (Excel F27)', () => {
    expect(overallAverage(nov, lines)).toBeCloseTo(138.3333, 3);
  });
  it('person average follows the worker across lines', () => {
    const e = [...rows('SL1', [100, 110, 120], ['w1']), ...rows('SL2', [null, null, null, 140, 150], ['w1', 'w2'])];
    expect(personAverage(e, 'w1')).toBeCloseTo(124, 3);
    expect(personAverage(e, 'w2')).toBeCloseTo(145, 3);
    expect(personAverage(e, 'nobody')).toBeNull();
  });
});

describe('Lot out', () => {
  const sent = [0, 10, 23, 39, 23, 11, 35, 0, 19, 26, 18];
  const nov: LotEntry[] = sent.map((s, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`, sent: s, patrol: 0, fg: i + 1 === 7 || i + 1 === 11 ? 1 : 0,
  }));
  it('totals use summed counts', () => {
    const t = lotTotals(nov);
    expect(t.sent).toBe(204);
    expect(t.out).toBe(2);
    expect(t.pct).toBeCloseTo(0.9804, 3);
    expect(lotTotals([{ date: '2026-11-01', sent: 0, patrol: 0, fg: 0 }]).pct).toBeNull();
  });
  it('weeks use day ranges', () => {
    const w = lotByWeek(nov, '2026-11');
    expect(w[1].sent).toBe(141);
    expect(w[1].out).toBe(1);
    expect(w[2].sent).toBe(63);
    expect(w[2].out).toBe(1);
    expect(w[3].pct).toBeNull();
  });
});

describe('cost and targets', () => {
  it('variance = standard - actual', () => {
    expect(variance(26548.43, 54594.25)).toBeCloseTo(-28045.82, 2);
    expect(variance(null, 1)).toBeNull();
  });
  it('target defaults', () => {
    expect(targetFor([], '2027-01')).toEqual({ month: '2027-01', perTarget: 125, lotOutTarget: 0.5 });
    expect(targetFor([{ month: '2026-01', perTarget: 120, lotOutTarget: 0.5 }], '2026-01').perTarget).toBe(120);
  });
});
