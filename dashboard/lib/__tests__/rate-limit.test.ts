import { checkRateLimit, RateLimitConfig } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  const config: RateLimitConfig = { maxRequests: 3, windowMs: 60000 };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow the first request', () => {
    const result = checkRateLimit('test-user-1', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should decrement remaining count on subsequent requests', () => {
    const key = 'test-user-2';
    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests after max is reached', () => {
    const key = 'test-user-3';
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after the window expires', () => {
    const key = 'test-user-4';
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    // Blocked
    expect(checkRateLimit(key, config).allowed).toBe(false);

    // Advance past the window
    jest.advanceTimersByTime(60001);

    // Should be allowed again
    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should track different keys independently', () => {
    const key1 = 'test-user-5a';
    const key2 = 'test-user-5b';

    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);

    // key1 is blocked
    expect(checkRateLimit(key1, config).allowed).toBe(false);

    // key2 should still be allowed
    const result = checkRateLimit(key2, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should return resetAt timestamp', () => {
    const now = Date.now();
    const result = checkRateLimit('test-user-6', config);
    expect(result.resetAt).toBeGreaterThanOrEqual(now);
    expect(result.resetAt).toBeLessThanOrEqual(now + config.windowMs + 100);
  });

  it('should return the same resetAt for blocked requests', () => {
    const key = 'test-user-7';
    const r1 = checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetAt).toBe(r1.resetAt);
  });
});
