import { PAL } from './palette';
import type { AgeBucket, PlanGroup } from '../types';

export const AGE_LABEL: Record<AgeBucket, string> = { lt2: '< 2 Month', m2to6: '2-6 Month', m6to12: '6-12 Month', gt12: '> 12 Month', noUsage: 'No Usage' };
/** Green for fresh stock through red for parts nobody uses, as in the original Turn Over charts. */
export const AGE_COLOR: Record<AgeBucket, string> = { lt2: '#22b573', m2to6: '#f7d84a', m6to12: '#ffb020', gt12: '#ff7a2f', noUsage: '#ef4056' };

export const PLAN_LABEL: Record<PlanGroup, string> = {
  singleLever: 'Single Lever', flushValve: 'Flush Valve', auto: 'AUTO', laser: 'LASER', sensor: 'SENSOR',
  skinPack: 'Skin Pack', sparePart: 'Spare Part', shower: 'Shower', package: 'Package', manual: 'Manual',
};
export const PLAN_COLOR: Record<PlanGroup, string> = {
  singleLever: '#22b573', flushValve: '#f7d84a', auto: '#ffb020', laser: '#ff7a2f', sensor: '#ef4056',
  skinPack: '#4aa8ff', sparePart: '#3346d3', shower: '#b06ad9', package: '#2fd3c4', manual: '#8a8799',
};
/** Part Warehouse colours, from the system palette: PUR and the count's actual violet, WIP and the plan soft violet. */
export const PW_COLOR = { wip: PAL.plan, pur: PAL.actual, total: PAL.ink, bar: PAL.actual, plan: PAL.plan, actual: PAL.actual, good: PAL.good, bad: PAL.bad, target: PAL.target, item: PAL.muted, prev: PAL.prev };
