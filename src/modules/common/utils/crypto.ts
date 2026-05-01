import { pbkdf2Sync, randomBytes, randomUUID } from 'crypto';

const SECRET_HASH_SALT = process.env.SECRET_HASH_SALT ?? 'api-key-hash-salt-v1';
const SECRET_HASH_ITERATIONS = 210000;
const SECRET_HASH_KEYLEN = 32;
const SECRET_HASH_DIGEST = 'sha512';

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function createJti(): string {
  return randomUUID();
}

export function hashSecret(secret: string): string {
  return pbkdf2Sync(
    secret,
    SECRET_HASH_SALT,
    SECRET_HASH_ITERATIONS,
    SECRET_HASH_KEYLEN,
    SECRET_HASH_DIGEST
  ).toString('hex');
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

