"""Run: DAILY_XLSX=path/to/Daily.xlsx python3 -m unittest scripts/test_parse_xlsx.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from parse_xlsx import parse  # noqa: E402

PATH = os.environ.get('DAILY_XLSX')


@unittest.skipUnless(PATH, 'set DAILY_XLSX to the workbook path')
class ParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = parse(PATH)

    def test_lines_and_setters(self):
        ls = self.d['lines']
        self.assertEqual(len(ls), 24)
        self.assertEqual((ls[0]['code'], ls[-1]['code']), ('SL1', 'Laser2'))
        self.assertEqual(ls[1]['setter'], 'ธนดล ใจกล้า')
        self.assertEqual(ls[3]['setter'], 'อดิศักดิ์ ศรีหานาถ')
        self.assertEqual([l['code'] for l in ls if l['includeInTotal']],
                         ['SL4', 'SL6', 'SL7', 'SL9', 'AUTO-FV', 'FV3', 'SKIN', 'Sensor', 'AUTO2'])
        self.assertEqual(len({l['id'] for l in ls}), 24)

    def test_workers(self):
        ls = {l['code']: l for l in self.d['lines']}
        self.assertEqual(ls['SL1']['defaultWorkerIds'], [])
        names = {w['id']: w['name'] for w in self.d['workers']}
        self.assertEqual([names[i] for i in ls['Sensor']['defaultWorkerIds']], ['นายสุชาติ อ.', 'น.ส.พนิดา พ.'])

    def test_per_entries(self):
        per = self.d['per']
        self.assertEqual(sorted({p['date'] for p in per}), [f'2026-11-0{d}' for d in range(2, 8)])
        sl2 = [p['per'] for p in per if p['lineId'] == 'sl2']
        self.assertAlmostEqual(sum(sl2) / len(sl2), 145.1667, 3)

    def test_lot(self):
        lot = self.d['lot']
        self.assertEqual(len(lot), 9)
        self.assertEqual(sum(e['sent'] for e in lot), 204)
        self.assertEqual(sum(e['patrol'] + e['fg'] for e in lot), 2)

    def test_targets_cost_summaries(self):
        t = {x['month']: x for x in self.d['targets']}
        self.assertEqual(len(t), 12)
        self.assertEqual(t['2026-01']['perTarget'], 120)
        self.assertEqual(t['2026-12']['perTarget'], 125)
        c = {x['month']: x for x in self.d['cost']}
        self.assertEqual(sorted(c), [f'2026-{m:02d}' for m in range(1, 11)])
        self.assertAlmostEqual(c['2026-10']['standard']['electric'] - c['2026-10']['actual']['electric'], -28045.82, 2)
        self.assertAlmostEqual(c['2026-01']['actual']['consumed'], 147083.68, 2)
        s = {x['month']: x for x in self.d['summaries']}
        self.assertEqual(s['2026-01'], {'month': '2026-01', 'per': 128, 'lotSent': 566, 'lotOut': 1})
        self.assertEqual(s['2026-10']['per'], 134)
        self.assertNotIn('2026-11', s)
        self.assertEqual(s['2025'], {'month': '2025', 'per': 124, 'lotSent': 8938, 'lotOut': 42})
        self.assertEqual(s['2024']['per'], 122)
        months = [x for x in self.d['summaries'] if x['month'].startswith('2026')]
        self.assertEqual(sum(x['lotSent'] for x in months) + 204, 6086)
        self.assertEqual(sum(x['lotOut'] for x in months) + 2, 30)


if __name__ == '__main__':
    unittest.main()
