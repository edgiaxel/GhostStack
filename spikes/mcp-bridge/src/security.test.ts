import { describe, expect, it } from 'vitest';
import {
  MIN_TOKEN_LENGTH,
  bearerToken,
  checkTokenStrength,
  isAllowedHost,
  isAllowedOrigin,
  tokensMatch,
} from './security';

describe('tokens', () => {
  it('matches only identical tokens, regardless of length', () => {
    const token = 'a'.repeat(40);
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(`${token}x`, token)).toBe(false);
    expect(tokensMatch('', token)).toBe(false);
    expect(tokensMatch(token.slice(1), token)).toBe(false);
  });

  it('parses a strict Bearer header', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    for (const bad of [
      undefined,
      '',
      'bearer abc',
      'Bearer',
      'Bearer a b',
      'Basic abc',
      'Bearer  abc',
    ]) {
      expect(bearerToken(bad)).toBeUndefined();
    }
  });

  it('refuses missing and short tokens', () => {
    expect(checkTokenStrength(undefined)).toBe('missing');
    expect(checkTokenStrength('')).toBe('missing');
    expect(checkTokenStrength('x'.repeat(MIN_TOKEN_LENGTH - 1))).toBe('too-short');
    expect(checkTokenStrength('x'.repeat(MIN_TOKEN_LENGTH))).toBeUndefined();
  });
});

describe('host and origin rules', () => {
  it('accepts loopback names for the bound port only', () => {
    for (const host of ['127.0.0.1:8000', 'localhost:8000', '[::1]:8000', 'LOCALHOST:8000']) {
      expect(isAllowedHost(host, 8000)).toBe(true);
    }
    for (const host of [
      undefined,
      '',
      'evil.example:8000',
      '127.0.0.1:8001',
      '127.0.0.1',
      'localhost.evil.example:8000',
      '0.0.0.0:8000',
      '192.168.1.5:8000',
    ]) {
      expect(isAllowedHost(host, 8000)).toBe(false);
    }
  });

  it('matches origins exactly with no wildcard and never accepts "null"', () => {
    const allowed = ['https://app.example'];
    expect(isAllowedOrigin('https://app.example', allowed)).toBe(true);
    for (const origin of [
      'https://app.example.evil.test',
      'http://app.example',
      'https://app.example/',
      'null',
      '*',
      'https://APP.example',
    ]) {
      expect(isAllowedOrigin(origin, allowed)).toBe(false);
    }
    expect(isAllowedOrigin('*', ['*'])).toBe(true);
    expect(isAllowedOrigin('https://app.example', [])).toBe(false);
  });
});
