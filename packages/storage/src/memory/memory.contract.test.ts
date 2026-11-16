import { runStoragePortContract } from '../testing';
import { createFaultController } from './faults';
import { createMemoryStorage } from './memoryStorage';

runStoragePortContract('memory', () => {
  const faults = createFaultController();
  return { port: createMemoryStorage({ faults }), faults };
});
