import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup.js';
import { sendBrevoEmail } from '../../lib/brevo.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

describe('sendBrevoEmail', () => {
  it('zwraca messageId po sukcesie (200)', async () => {
    let capturedBody;
    let capturedHeaders;
    server.use(
      http.post(BREVO_URL, async ({ request }) => {
        capturedBody = await request.json();
        capturedHeaders = Object.fromEntries(request.headers);
        return HttpResponse.json({ messageId: '<abc@smtp.brevo.com>' }, { status: 201 });
      })
    );

    const result = await sendBrevoEmail({
      apiKey: 'xkeysib-test',
      to: 'a@b.com',
      subject: 'Test',
      htmlContent: '<p>hi</p>',
    });

    expect(result.messageId).toBe('<abc@smtp.brevo.com>');
    expect(capturedBody.to).toEqual([{ email: 'a@b.com' }]);
    expect(capturedBody.subject).toBe('Test');
    expect(capturedBody.htmlContent).toBe('<p>hi</p>');
    expect(capturedBody.sender).toEqual({ name: 'VPS4U', email: 'info@vps4u.xyz' });
    expect(capturedHeaders['api-key']).toBe('xkeysib-test');
  });

  it('akceptuje custom sender', async () => {
    let capturedBody;
    server.use(
      http.post(BREVO_URL, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ messageId: '<x@y>' });
      })
    );

    await sendBrevoEmail({
      apiKey: 'xkeysib-test',
      to: 'a@b.com',
      subject: 'T',
      htmlContent: '<p/>',
      sender: { name: 'Alerts', email: 'alerts@vps4u.xyz' },
    });

    expect(capturedBody.sender).toEqual({ name: 'Alerts', email: 'alerts@vps4u.xyz' });
  });

  it('rzuca błąd przy 4xx/5xx z czytelnym komunikatem', async () => {
    server.use(
      http.post(
        BREVO_URL,
        () =>
          new HttpResponse(JSON.stringify({ code: 'unauthorized', message: 'Bad key' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
      )
    );

    await expect(
      sendBrevoEmail({
        apiKey: 'xkeysib-bad',
        to: 'a@b.com',
        subject: 'T',
        htmlContent: '<p/>',
      })
    ).rejects.toThrow(/Brevo.*401/);
  });

  it('rzuca przy braku wymaganych pól', async () => {
    await expect(sendBrevoEmail({ apiKey: 'k', subject: 's', htmlContent: 'h' })).rejects.toThrow(
      /to/
    );

    await expect(sendBrevoEmail({ to: 'a@b.com', subject: 's', htmlContent: 'h' })).rejects.toThrow(
      /apiKey/
    );
  });
});
