const PRIMES: number[] = [];
for (let candidate = 2; PRIMES.length < 64; candidate += 1) {
  if (PRIMES.every((prime) => candidate % prime !== 0)) PRIMES.push(candidate);
}

const fraction32 = (value: number): number => Math.floor((value - Math.floor(value)) * 2 ** 32);

const ROUND_CONSTANTS = Uint32Array.from(PRIMES, (prime) => fraction32(Math.cbrt(prime)));
const INITIAL_HASH = Uint32Array.from(PRIMES.slice(0, 8), (prime) => fraction32(Math.sqrt(prime)));

const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

// Synchronous SHA-256 so fast-check generators can map bytes to checksums without async.
export function sha256Hex(bytes: Uint8Array): string {
  const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = Uint32Array.from(INITIAL_HASH);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as unknown as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i += 1) {
      const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + ROUND_CONSTANTS[i]! + w[i]!) >>> 0;
      const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i += 1) hash[i] = (hash[i]! + next[i]!) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}

/** Registry checksum format: `sha256:` followed by 64 lowercase hex digits. */
export const checksumOf = (bytes: Uint8Array): string => `sha256:${sha256Hex(bytes)}`;
