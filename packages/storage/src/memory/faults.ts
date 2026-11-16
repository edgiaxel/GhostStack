import type { StorageErrorCode } from '../port';

export type InjectedFaultCode = Extract<StorageErrorCode, 'write-failed' | 'quota-exceeded'>;

/** Test seam: makes the next write operation fail without changing stored state. */
export interface FaultController {
  failNextWrite(code: InjectedFaultCode): void;
  /** Called by the storage implementation. Returns the pending fault once, then clears it. */
  takeFault(): InjectedFaultCode | undefined;
}

export function createFaultController(): FaultController {
  let pending: InjectedFaultCode | undefined;
  return {
    failNextWrite(code) {
      pending = code;
    },
    takeFault() {
      const code = pending;
      pending = undefined;
      return code;
    },
  };
}
