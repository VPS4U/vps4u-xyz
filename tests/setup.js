// MSW setup dla testów. Każdy test plik może dorzucać własne handlery
// przez `server.use(...)`. Domyślnie serwer nie ma handlerów — nieobsłużone
// requesty fetch'owe failują test z czytelnym błędem.

import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
