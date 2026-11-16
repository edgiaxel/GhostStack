import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { runStoragePortContract } from '../testing';
import type { ContractFaultCode } from '../testing';
import { createIndexedDbStorage } from './indexedDbStorage';

runStoragePortContract('indexeddb', () => {
  let pending: ContractFaultCode | undefined;
  const port = createIndexedDbStorage({
    factory: new IDBFactory(),
    faultInjection: () => {
      const code = pending;
      pending = undefined;
      if (code === 'quota-exceeded') throw new DOMException('Quota.', 'QuotaExceededError');
      if (code === 'write-failed') throw new Error('Injected write failure.');
    },
  });
  return {
    port,
    faults: {
      failNextWrite(code) {
        pending = code;
      },
    },
  };
});
