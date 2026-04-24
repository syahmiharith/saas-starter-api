import { createApiKeySecret, createOpaqueToken, hashSecret } from './crypto';

describe('crypto utils', () => {
  it('hashes secrets deterministically without returning the raw secret', () => {
    const secret = 'secret-value';
    expect(hashSecret(secret)).toBe(hashSecret(secret));
    expect(hashSecret(secret)).not.toContain(secret);
  });

  it('creates opaque tokens', () => {
    expect(createOpaqueToken()).not.toEqual(createOpaqueToken());
  });

  it('creates API keys with a stable prefix and hashed secret', () => {
    const key = createApiKeySecret();
    expect(key.secret.startsWith(`${key.prefix}.`)).toBe(true);
    expect(key.hash).toBe(hashSecret(key.secret));
  });
});

