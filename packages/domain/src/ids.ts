export type IdPrefix = 'stk' | 'crd' | 'elm' | 'ast';
export type IdGenerator = (prefix: IdPrefix) => string;

export const UUID_V4_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export const ID_PATTERNS = {
  stk: new RegExp(`^stk_${UUID_V4_SOURCE}$`),
  crd: new RegExp(`^crd_${UUID_V4_SOURCE}$`),
  elm: new RegExp(`^elm_${UUID_V4_SOURCE}$`),
  ast: new RegExp(`^ast_${UUID_V4_SOURCE}$`),
} as const;

const HEX = '0123456789abcdef';

// Uses getRandomValues, not randomUUID: randomUUID is absent in insecure contexts such as plain-HTTP LAN origins.
export const generateId: IdGenerator = (prefix) => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  let hex = '';
  for (const byte of bytes) {
    hex += HEX[byte >> 4]! + HEX[byte & 0x0f]!;
  }
  return (
    `${prefix}_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`
  );
};
