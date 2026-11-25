import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createIdbStackRepository } from '@ghoststack/storage';
import type { StackRepository } from '@ghoststack/shared-contracts';

/** Single dependency-injection point. Features read services here; they never open IndexedDB themselves. */
export interface AppServices {
  stacks: StackRepository;
}

const Ctx = createContext<AppServices | undefined>(undefined);

export function ServicesProvider({ children }: { children: ReactNode }): ReactNode {
  const services = useMemo<AppServices>(() => ({ stacks: createIdbStackRepository() }), []);
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error('useServices outside ServicesProvider');
  return v;
}
