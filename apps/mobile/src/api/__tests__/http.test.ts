import { ServiceError } from '@/services/types';
import { z } from 'zod';
import { createApiClient, toServiceError } from '../http';

const reply = (status: number, body?: unknown) =>
  jest.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response);

function client(fetchImpl: jest.Mock, token: string | null = 'tok') {
  const onUnauthenticated = jest.fn(async () => {});
  const api = createApiClient({ baseUrl: 'http://api.test/', accessToken: async () => token, onUnauthenticated, fetch: fetchImpl });
  return { api, onUnauthenticated };
}

const fail = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as ServiceError;
  }
  throw new Error('expected a failure');
};

describe('API client', () => {
  it('sends the bearer token and validates the response', async () => {
    const f = reply(200, { ok: true });
    const { api } = client(f);
    expect(await api.call('GET', '/me', z.object({ ok: z.boolean() }))).toEqual({ ok: true });
    expect(f).toHaveBeenCalledWith('http://api.test/api/v1/me', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer tok' }),
    }));
  });

  it('turns a 401 into a signed-out session', async () => {
    const { api, onUnauthenticated } = client(reply(401, { error: { code: 'unauthenticated', message: 'x', retryable: false } }));
    expect((await fail(api.call('GET', '/me', null))).code).toBe('unauthenticated');
    expect(onUnauthenticated).toHaveBeenCalled();
  });

  it('does not call the API at all without a session', async () => {
    const f = reply(200, {});
    const { api, onUnauthenticated } = client(f, null);
    expect((await fail(api.call('GET', '/me', null))).code).toBe('unauthenticated');
    expect(f).not.toHaveBeenCalled();
    expect(onUnauthenticated).toHaveBeenCalled();
  });

  it('reports network failure as offline and an unexpected body as unavailable', async () => {
    const { api } = client(jest.fn(async () => { throw new TypeError('Network request failed'); }));
    expect((await fail(api.call('GET', '/me', null))).code).toBe('offline');
    const { api: api2 } = client(reply(200, { surprise: 1 }));
    expect((await fail(api2.call('GET', '/me', z.object({ ok: z.boolean() })))).code).toBe('unavailable');
  });

  it('shows the server envelope message and hides anything else', () => {
    expect(toServiceError(422, { error: { code: 'validation_failed', message: 'Some of the details are not valid.', retryable: false } }).message)
      .toBe('Some of the details are not valid.');
    const raw = toServiceError(502, '<html>Bad Gateway nginx/1.2</html>');
    expect(raw.code).toBe('unavailable');
    expect(raw.message).not.toMatch(/nginx|html/);
    expect(toServiceError(418, { stack: 'Error at …' }).message).toBe('Something went wrong. Try again.');
  });
});
