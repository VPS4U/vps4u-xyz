import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('createSupabaseAdmin', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('tworzy klienta z service_role key i auto-refresh wyłączonym', async () => {
    const createClient = vi.fn(() => ({ from: vi.fn() }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));

    const { createSupabaseAdmin } = await import('../../lib/supabase-admin.js');
    const client = createSupabaseAdmin({
      url: 'https://test.supabase.co',
      serviceKey: 'eyJ-service-role',
    });

    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'eyJ-service-role',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      })
    );
    expect(client).toBeDefined();
  });

  it('rzuca błąd gdy brak url lub serviceKey', async () => {
    vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
    const { createSupabaseAdmin } = await import('../../lib/supabase-admin.js');

    expect(() => createSupabaseAdmin({ serviceKey: 'k' })).toThrow(/url/);
    expect(() => createSupabaseAdmin({ url: 'https://x.supabase.co' })).toThrow(/serviceKey/);
  });
});
