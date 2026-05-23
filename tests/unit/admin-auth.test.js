import { describe, it, expect } from 'vitest';
import { extractBearerToken } from '../../lib/admin-auth.js';

describe('extractBearerToken', () => {
  it('wyciąga token z poprawnego Authorization headera', () => {
    expect(extractBearerToken({ authorization: 'Bearer eyJxyz' })).toBe('eyJxyz');
  });

  it('akceptuje case-insensitive prefix', () => {
    expect(extractBearerToken({ authorization: 'bearer eyJxyz' })).toBe('eyJxyz');
  });

  it('akceptuje capitalized header key', () => {
    expect(extractBearerToken({ Authorization: 'Bearer eyJxyz' })).toBe('eyJxyz');
  });

  it('zwraca null gdy brak headera', () => {
    expect(extractBearerToken({})).toBeNull();
  });

  it('zwraca null gdy header bez Bearer prefix', () => {
    expect(extractBearerToken({ authorization: 'Basic abc' })).toBeNull();
    expect(extractBearerToken({ authorization: 'eyJxyz' })).toBeNull();
  });
});

// requireAdmin testowane integracyjnie via /api/admin/* endpoints (wymaga prawdziwego JWT).
