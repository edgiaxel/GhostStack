export { connectBridge } from './client';
export type { BridgeConnection, BridgeState, BridgeStatus, ConnectBridgeOptions, SocketLike } from './client';
export { createBridgeHandlers, MAX_PENDING_PROPOSALS } from './handlers';
export type { BridgeHandlerDeps, BridgeHandlers } from './handlers';
export { BridgePairing } from './BridgePairing';
export type { BridgePairingProps } from './BridgePairing';
export { parsePairingCode } from './protocol';
