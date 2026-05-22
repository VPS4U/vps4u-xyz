import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup.js';
import { getEurPlnRate, convertEurCentsToPlnGrosze } from '../../lib/fx.js';

describe('getEurPlnRate', () => {
  it('zwraca kurs z tabeli NBP dla podanej daty', async () => {
    server.use(
      http.get('https://api.nbp.pl/api/exchangerates/rates/A/EUR/2026-05-15/', () =>
        HttpResponse.json({
          table: 'A',
          currency: 'euro',
          code: 'EUR',
          rates: [{ no: '093/A/NBP/2026', effectiveDate: '2026-05-15', mid: 4.3215 }],
        })
      )
    );

    const result = await getEurPlnRate(new Date('2026-05-15T12:00:00Z'));
    expect(result.rate).toBe(4.3215);
    expect(result.table_date).toBe('2026-05-15');
    expect(result.source).toBe('nbp_a');
  });

  it('po 404 (weekend/święto) pobiera ostatnią dostępną tabelę', async () => {
    server.use(
      http.get(
        'https://api.nbp.pl/api/exchangerates/rates/A/EUR/2026-05-17/',
        () => new HttpResponse(null, { status: 404 })
      ),
      http.get('https://api.nbp.pl/api/exchangerates/rates/A/EUR/', () =>
        HttpResponse.json({
          table: 'A',
          currency: 'euro',
          code: 'EUR',
          rates: [{ no: '093/A/NBP/2026', effectiveDate: '2026-05-15', mid: 4.3215 }],
        })
      )
    );

    const result = await getEurPlnRate(new Date('2026-05-17T12:00:00Z'));
    expect(result.rate).toBe(4.3215);
    expect(result.table_date).toBe('2026-05-15');
    expect(result.source).toBe('nbp_a');
  });

  it('rzuca błąd gdy NBP API odpowiada innym kodem niż 200/404', async () => {
    server.use(
      http.get(
        'https://api.nbp.pl/api/exchangerates/rates/A/EUR/2026-05-15/',
        () => new HttpResponse('boom', { status: 500 })
      )
    );

    await expect(getEurPlnRate(new Date('2026-05-15T12:00:00Z'))).rejects.toThrow(/NBP/);
  });
});

describe('convertEurCentsToPlnGrosze', () => {
  it('1000 cents EUR × 4.3215 = 4321 grosze', () => {
    // 10.00 EUR × 4.3215 = 43.215 PLN = 4321.5 grosze → round = 4322 grosze (banker's? half-up)
    // Postanawiamy: zwykły Math.round (half-up) — wystarczająca precyzja dla cap tracking
    expect(convertEurCentsToPlnGrosze(1000, 4.3215)).toBe(4322);
  });

  it('0 cents = 0 grosze', () => {
    expect(convertEurCentsToPlnGrosze(0, 4.3215)).toBe(0);
  });

  it('zaokrąglenie w dół przy 0.4 grosza', () => {
    // 100 cents × 4.0040 = 4.0040 PLN = 400.4 grosze → 400
    expect(convertEurCentsToPlnGrosze(100, 4.004)).toBe(400);
  });

  it('zaokrąglenie w górę przy 0.5 grosza', () => {
    // 100 cents × 4.0050 = 4.0050 PLN = 400.5 grosze → 401
    expect(convertEurCentsToPlnGrosze(100, 4.005)).toBe(401);
  });

  it('rzuca przy ujemnej kwocie', () => {
    expect(() => convertEurCentsToPlnGrosze(-100, 4.3215)).toThrow();
  });

  it('rzuca przy zerowym/ujemnym kursie', () => {
    expect(() => convertEurCentsToPlnGrosze(100, 0)).toThrow();
    expect(() => convertEurCentsToPlnGrosze(100, -1)).toThrow();
  });
});
