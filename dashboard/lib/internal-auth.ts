import { timingSafeEqual } from 'crypto';

/**
 * Internal API authentication for service-to-service calls.
 *
 * Uses a shared API key (WORKER_API_KEY env var) to authenticate
 * requests from the worker agent to internal endpoints.
 * Similar pattern to Stripe webhook signature verification.
 */

export function requireInternalAuth(request: Request): void {
  const apiKey = process.env.WORKER_API_KEY;
  if (!apiKey) {
    throw new Error('WORKER_API_KEY is not configured');
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.slice(7);

  // Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token);
  const apiKeyBuffer = Buffer.from(apiKey);

  if (tokenBuffer.length !== apiKeyBuffer.length || !timingSafeEqual(tokenBuffer, apiKeyBuffer)) {
    throw new Error('Unauthorized');
  }
}
