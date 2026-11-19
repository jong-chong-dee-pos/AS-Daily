/** W1 = day 1–7, W2 = 8–14, W3 = 15–21, W4 = 22–end of month. */
export type Week = 1 | 2 | 3 | 4;

export function weekOf(date: string): Week {
  const day = Number(date.slice(8, 10));
  return Math.min(4, Math.floor((day - 1) / 7) + 1) as Week;
}
