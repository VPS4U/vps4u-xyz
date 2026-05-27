import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateVpsPayload, markVpsDelivered } from '../../lib/admin-vps.js';
import crypto from 'node:crypto';

const KEY = crypto.randomBytes(32).toString('base64');

describe('validateVpsPayload', () => {
  it('accepts valid provider', () => {
    expect(validateVpsPayload({ provider: 'hetzner_cx' })).toEqual({ provider: 'hetzner_cx' });
  });

  it('rejects invalid provider', () => {
    expect(() => validateVpsPayload({ provider: 'aws' })).toThrow(/provider must be one of/);
  });

  it('normalizes empty string IPs to null', () => {
    expect(validateVpsPayload({ ipv4: '', ipv6: '' })).toEqual({ ipv4: null, ipv6: null });
  });

  it('defaults ssh_user to root when empty', () => {
    expect(validateVpsPayload({ ssh_user: '' }).ssh_user).toBe('root');
  });

  it('throws on non-object', () => {
    expect(() => validateVpsPayload(null)).toThrow();
    expect(() => validateVpsPayload('x')).toThrow();
  });
});

describe('markVpsDelivered', () => {
  let supabase, deps, sendDeliveryEmail;

  beforeEach(() => {
    sendDeliveryEmail = vi.fn().mockResolvedValue(undefined);

    // Mock chainable supabase client
    const existing = {
      id: 'vps-1',
      user_id: 'user-1',
      line_sku: 'czarny',
      hardware_combo: 'L',
      addons: [],
      provider: 'hetzner_cx',
      status: 'pending',
    };
    const updated = {
      id: 'vps-1',
      user_id: 'user-1',
      line_sku: 'czarny',
      hardware_combo: 'L',
      addons: [],
      provider: 'hetzner_cx',
      ipv4: '1.2.3.4',
      ssh_user: 'root',
      provisioned_at: '2026-05-27T00:00:00Z',
    };

    supabase = {
      from: vi.fn((table) => {
        if (table === 'vps_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
            single: vi.fn().mockResolvedValue({ data: updated, error: null }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { email: 'klient@test.pl' }, error: null }),
          };
        }
        return {};
      }),
    };

    deps = { supabase, encryptionKey: KEY, sendDeliveryEmail };
  });

  it('encrypts credentials, sets active, sends mail', async () => {
    const result = await markVpsDelivered({
      id: 'vps-1',
      fields: { ipv4: '1.2.3.4' },
      sshCredentials: 'super-secret-pw',
      deps,
    });

    expect(result.delivered).toBe(true);
    expect(sendDeliveryEmail).toHaveBeenCalledOnce();
    expect(sendDeliveryEmail.mock.calls[0][0].to).toBe('klient@test.pl');
    expect(sendDeliveryEmail.mock.calls[0][0].sshCredentials).toBe('super-secret-pw');
  });

  it('idempotent — already active returns flag without sending mail again', async () => {
    supabase.from = vi.fn((table) => {
      if (table === 'vps_instances') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'vps-1',
              user_id: 'u',
              line_sku: 'x',
              hardware_combo: 'L',
              addons: [],
              provider: 'hetzner_cx',
              status: 'active',
            },
            error: null,
          }),
        };
      }
      return {};
    });
    deps.supabase = supabase;

    const result = await markVpsDelivered({ id: 'vps-1', fields: {}, deps });
    expect(result.already_active).toBe(true);
    expect(sendDeliveryEmail).not.toHaveBeenCalled();
  });

  it('throws when vps_instance not found', async () => {
    supabase.from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    deps.supabase = supabase;

    await expect(markVpsDelivered({ id: 'missing', fields: {}, deps })).rejects.toThrow(
      /not found/
    );
  });
});
