export function applyTestEnvDefaults() {
  process.env.NODE_ENV ||= 'test';
  process.env.PORT ||= '0';
  process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-at-least-long-enough';
  process.env.JWT_ACCESS_TTL ||= '15m';
  process.env.REFRESH_TOKEN_TTL_DAYS ||= '30';
  process.env.REDIS_HOST ||= 'localhost';
  process.env.REDIS_PORT ||= '6379';
  process.env.APP_BASE_URL ||= 'http://localhost:3000';
  process.env.PLATFORM_ADMIN_EMAIL ||= 'admin@example.test';
  process.env.PLATFORM_ADMIN_PASSWORD ||= 'AdminPass123!';
  process.env.STRIPE_SECRET_KEY ||= 'sk_test_local';
  process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_test_secret';

  process.env.STRIPE_PRICE_FREE ??= '';
  process.env.STRIPE_PRICE_PRO ??= '';
  process.env.STRIPE_PRICE_TEAM ??= '';
  process.env.STRIPE_PRICE_ENTERPRISE ??= '';
}
