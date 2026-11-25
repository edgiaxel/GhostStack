import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createIdbStorage } from '@ghoststack/storage';
import type {
  AssetRepository,
  CheckpointRepository,
  StackRepository,
  StackSessionFactory,
} from '@ghoststack/shared-contracts';
import { createStackSessionFactory } from '../features/history/session';

/** Single dependency-injection point. Features read services here; they never open IndexedDB themselves. */
export interface AppServices {
  stacks: StackRepository;
  /** Binary asset storage. Metadata lives in `Stack.assetRegistry`. */
  assets: AssetRepository;
  checkpoints: CheckpointRepository;
  /** Opens editing sessions. Features dispatch commands through the session, never through `stacks`. */
  sessions: StackSessionFactory;
}

const Ctx = createContext<AppServices | undefined>(undefined);

export function ServicesProvider({ children }: { children: ReactNode }): ReactNode {
  const services = useMemo<AppServices>(() => {
    const storage = createIdbStorage();
    return {
      ...storage,
      sessions: createStackSessionFactory({ stacks: storage.stacks, checkpoints: storage.checkpoints }),
    };
  }, []);
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error('useServices outside ServicesProvider');
  return v;
}
