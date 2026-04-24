import { createHash, randomBytes, randomUUID } from 'crypto';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createJti(): string {
  return randomUUID();
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function createApiKeySecret() {
  const visible = randomBytes(6).toString('base64url');
  const secret = randomBytes(32).toString('base64url');
  const fullSecret = `sk_test_${visible}.${secret}`;
  return {
    prefix: `sk_test_${visible}`,
    secret: fullSecret,
    hash: hashSecret(fullSecret)
  };
}

