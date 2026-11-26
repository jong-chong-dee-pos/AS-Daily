import { PAL } from './palette';
import type { AgeBucket, PlanGroup } from '../types';

export const AGE_LABEL: Record<AgeBucket, string> = { lt2: '< 2 Month', m2to6: '2-6 Month', m6to12: '6-12 Month', gt12: '> 12 Month', noUsage: 'No Usage' };
/** Green for fresh stock through red for parts nobody uses, as in the original Turn Over charts. */
export const AGE_COLOR: Record<AgeBucket, string> = { lt2: '#1b8f55', m2to6: '#dcae00', m6to12: '#e64a19', gt12: '#b0164e', noUsage: '#7e57c2' };

export const PLAN_LABEL: Record<PlanGroup, string> = {
  singleLever: 'Single Lever', flushValve: 'Flush Valve', auto: 'AUTO', laser: 'LASER', sensor: 'SENSOR',
  skinPack: 'Skin Pack', sparePart: 'Spare Part', shower: 'Shower', package: 'Package', manual: 'Manual',
};
export const PLAN_COLOR: Record<PlanGroup, string> = {
  singleLever: '#257de0', flushValve: '#f47230', auto: '#00a88a', laser: '#d99a00', sensor: '#e0569b',
  skinPack: '#2e8b3a', sparePart: '#6a4ce2', shower: '#d63a3a', package: '#38b6e8', manual: '#a0652a',
};
/** Part Warehouse colours, from the system palette: PUR and the count's actual violet, WIP and the plan soft violet. */
export const PW_COLOR = { wip: PAL.plan, pur: PAL.actual, total: PAL.ink, bar: PAL.actual, plan: PAL.plan, actual: PAL.actual, good: PAL.good, bad: PAL.bad, target: PAL.target, item: PAL.muted, prev: PAL.prev };
