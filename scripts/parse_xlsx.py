"""Read Daily.xlsx and print the app's import data as JSON.

Usage: python3 scripts/parse_xlsx.py Daily.xlsx > import.json

Python + openpyxl (read-only) is used because the workbook carries ~80 external
links and a 2 MB defined-name table that exhaust memory in exceljs.
"""
import json
import re
import sys
from datetime import date, datetime

import openpyxl

YEAR = 2026
PER_DAILY = '% Per (Nov_26).'
PER_MONTH = '% Per (Month)_'
LOT_DAILY = 'Lot out (Daily)Nov_26'
LOT_MONTH = 'Lot out (Month)_26'
DAILY_MONTH = 11
COST_SHEETS = {'electric': 'Electric', 'laborOT': 'Labor-OT', 'laborSub': 'Labor-Sub.', 'consumed': 'Consumed.'}
# Excel F27 = AVERAGE(F6,F8,F9,F11:F12,F14,F21,F23,F24): the lines in the overall % PER.
INCLUDED_ROWS = {6, 8, 9, 11, 12, 14, 21, 23, 24}
LOT_OUT_TARGET = 0.5
YEARLY = {'2024': {'per': 122, 'lotSent': None, 'lotOut': None}}  # 2025 is read from the sheets


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def clean(v):
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''


def slug(code):
    return re.sub(r'[^a-z0-9]+', '-', code.lower().replace('&', '-')).strip('-')


def rows(ws, first, last, cols=45):
    return {r: list(vals) for r, vals in enumerate(
        ws.iter_rows(min_row=first, max_row=last, max_col=cols, values_only=True), first)}


def ymd(m, d):
    return date(YEAR, m, d).isoformat()


def parse_per_daily(ws):
    grid = rows(ws, 2, 40)
    header = grid[2]
    day_cols = {i: int(v) for i, v in enumerate(header) if isinstance(v, (int, float)) and i >= 6}
    lines, workers, per, by_name = [], [], [], {}
    setter = ''
    for r in range(3, 41):
        row = grid.get(r) or []
        code = clean(row[3]) if len(row) > 3 else ''
        if not code:
            continue
        if clean(row[0]):
            setter = clean(row[0])
        ids = []
        for name in (clean(n) for n in clean(row[2]).split(',')):
            if not name or name == '0':
                continue
            if name not in by_name:
                by_name[name] = f'w{len(by_name) + 1:02d}'
                workers.append({'id': by_name[name], 'name': name, 'active': True})
            ids.append(by_name[name])
        lid = slug(code)
        lines.append({'id': lid, 'code': code, 'order': len(lines) + 1, 'setter': setter,
                      'defaultWorkerIds': ids, 'includeInTotal': r in INCLUDED_ROWS, 'active': True})
        for i, d in day_cols.items():
            v = num(row[i]) if i < len(row) else None
            if v is not None:
                per.append({'date': ymd(DAILY_MONTH, d), 'lineId': lid, 'workerIds': ids, 'per': v})
    return lines, workers, per


def parse_lot_daily(ws):
    g = rows(ws, 18, 21)
    out = []
    for i, d in enumerate(g[18]):
        if not (isinstance(d, (int, float)) and 1 <= d <= 31):
            continue
        sent = num(g[19][i])
        if sent is None:
            continue
        out.append({'date': ymd(DAILY_MONTH, int(d)), 'sent': int(sent),
                    'patrol': int(num(g[20][i]) or 0), 'fg': int(num(g[21][i]) or 0)})
    return out


def month_cols(header):
    """Map column index → month number from a Jan..Dec or date header row."""
    names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    out = {}
    for i, v in enumerate(header):
        if isinstance(v, (datetime, date)):
            out[i] = v.month
        elif clean(v).lower()[:3] in names:
            out[i] = names.index(clean(v).lower()[:3]) + 1
    return out


def mkey(m):
    return f'{YEAR}-{m:02d}'


def parse(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lines, workers, per = parse_per_daily(wb[PER_DAILY])
    lot = parse_lot_daily(wb[LOT_DAILY])

    pm = rows(wb[PER_MONTH], 28, 30)
    pcols = month_cols(pm[28])
    targets = [{'month': mkey(m), 'perTarget': num(pm[30][i]), 'lotOutTarget': LOT_OUT_TARGET}
               for i, m in pcols.items() if num(pm[30][i]) is not None]
    lm = rows(wb[LOT_MONTH], 18, 20)
    lcols = month_cols(lm[18])
    lot_by_month = {m: (num(lm[19][i]), num(lm[20][i])) for i, m in lcols.items()}

    summaries = []
    for i, m in pcols.items():
        if m >= DAILY_MONTH:
            continue  # months with daily data are computed by the app
        p = num(pm[29][i])
        s, o = lot_by_month.get(m, (None, None))
        if p is None and s is None:
            continue
        summaries.append({'month': mkey(m), 'per': p, 'lotSent': s, 'lotOut': o})
    hdr = [clean(v) for v in pm[28]]
    lhdr = [clean(v) for v in lm[18]]
    y25 = {'per': num(pm[29][hdr.index('AVG-25')]),
           'lotSent': num(lm[19][lhdr.index(str(YEAR - 1))]), 'lotOut': num(lm[20][lhdr.index(str(YEAR - 1))])}
    for y, v in {**YEARLY, str(YEAR - 1): y25}.items():
        summaries.append({'month': y, **v})

    cost = {}
    for cat, sheet in COST_SHEETS.items():
        g = rows(wb[sheet], 24, 26, 16)
        for i, m in month_cols(g[24]).items():
            st, ac = num(g[25][i]), num(g[26][i])
            if st is None and ac is None:
                continue
            c = cost.setdefault(m, {'month': mkey(m), 'standard': {k: None for k in COST_SHEETS},
                                    'actual': {k: None for k in COST_SHEETS}})
            c['standard'][cat], c['actual'][cat] = st, ac
    return {'lines': lines, 'workers': workers, 'per': per, 'lot': lot,
            'cost': [cost[m] for m in sorted(cost)], 'targets': targets, 'summaries': summaries}


if __name__ == '__main__':
    json.dump(parse(sys.argv[1]), sys.stdout, ensure_ascii=False, indent=1)
