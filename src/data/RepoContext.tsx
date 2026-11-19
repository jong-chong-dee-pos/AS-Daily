import { createContext, useContext } from 'react';
import type { Repo } from './repo';

export const RepoContext = createContext<Repo | null>(null);
export function useRepo(): Repo {
  const r = useContext(RepoContext);
  if (!r) throw new Error('RepoContext missing');
  return r;
}
