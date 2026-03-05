import { requireInternalAuth } from '@/lib/internal-auth';

/** Create a mock Request with the given headers */
function mockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe('requireInternalAuth', () => {
  const VALID_API_KEY = 'test-secret-key-abc123';

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WORKER_API_KEY;
  });

  afterEach(() => {
    delete process.env.WORKER_API_KEY;
  });

  it('should throw when WORKER_API_KEY is not configured', () => {
    const request = mockRequest({ authorization: `Bearer ${VALID_API_KEY}` });

    expect(() => requireInternalAuth(request)).toThrow('WORKER_API_KEY is not configured');
  });

  it('should throw when authorization header is missing', () => {
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const request = mockRequest();

    expect(() => requireInternalAuth(request)).toThrow('Unauthorized');
  });

  it('should throw when wrong prefix is used (Basic instead of Bearer)', () => {
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const request = mockRequest({ authorization: `Basic ${VALID_API_KEY}` });

    expect(() => requireInternalAuth(request)).toThrow('Unauthorized');
  });

  it('should throw when token is wrong', () => {
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const request = mockRequest({ authorization: 'Bearer wrong-token-value' });

    expect(() => requireInternalAuth(request)).toThrow('Unauthorized');
  });

  it('should pass with correct token', () => {
    process.env.WORKER_API_KEY = VALID_API_KEY;

    const request = mockRequest({ authorization: `Bearer ${VALID_API_KEY}` });

    expect(() => requireInternalAuth(request)).not.toThrow();
  });
});
