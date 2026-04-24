import { execFileSync } from 'node:child_process';

type JsonObject = Record<string, any>;

const baseUrl = trimTrailingSlash(
  process.env.STAGING_BASE_URL ||
    process.env.APP_BASE_URL ||
    'https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app'
);
const identityToken = process.env.STAGING_IDENTITY_TOKEN || tryGetGcloudIdentityToken();

async function main() {
  const stamp = Date.now();
  const email = `staging-smoke-${stamp}@example.com`;
  const password = 'SmokePass123!';

  await expectStatus('health', 'GET', '/api/v1/health', undefined, 200);
  await expectStatus('docs', 'GET', '/docs', undefined, 200, false);

  const registered = await requestJson('POST', '/api/v1/auth/register', {
    email,
    password,
    name: 'Staging Smoke',
    organizationName: 'Staging Smoke Org'
  });
  assert(Boolean(registered.defaultOrganization?.id), 'register should create a default organization');

  const login = await requestJson('POST', '/api/v1/auth/login', { email, password });
  assert(Boolean(login.accessToken), 'login should return an access token');

  const me = await requestJson('GET', '/api/v1/users/me', undefined, login.accessToken);
  assert(me.email === email, 'users/me should return the logged-in user');

  const checkout = await requestJson(
    'POST',
    `/api/v1/organizations/${registered.defaultOrganization.id}/billing/checkout`,
    { plan: 'pro' },
    login.accessToken
  );
  assert(Boolean(checkout.url), 'billing checkout should return a URL');

  if (process.env.STAGING_ADMIN_EMAIL && process.env.STAGING_ADMIN_PASSWORD) {
    const adminLogin = await requestJson('POST', '/api/v1/auth/login', {
      email: process.env.STAGING_ADMIN_EMAIL,
      password: process.env.STAGING_ADMIN_PASSWORD
    });
    const metrics = await requestJson('GET', '/api/v1/admin/metrics', undefined, adminLogin.accessToken);
    assert(typeof metrics.users === 'number', 'admin metrics should return user counts');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        registeredEmail: email,
        checkoutUrlHost: checkout.url ? new URL(checkout.url).host : null,
        adminMetricsChecked: Boolean(process.env.STAGING_ADMIN_EMAIL && process.env.STAGING_ADMIN_PASSWORD)
      },
      null,
      2
    )
  );
}

async function expectStatus(
  label: string,
  method: string,
  path: string,
  body: JsonObject | undefined,
  status: number,
  parseJson = true
) {
  const response = await rawRequest(method, path, body);
  if (response.status !== status) {
    throw new Error(
      `${label} expected ${status}, received ${response.status} (iamTokenFound=${Boolean(
        identityToken
      )}): ${await response.text()}`
    );
  }

  if (parseJson) {
    return response.json();
  }
  return response.text();
}

async function requestJson(method: string, path: string, body?: JsonObject, appToken?: string) {
  const response = await rawRequest(method, path, body, appToken);
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

function rawRequest(method: string, path: string, body?: JsonObject, appToken?: string) {
  const headers: Record<string, string> = {
    accept: 'application/json'
  };

  if (identityToken && appToken) {
    headers['X-Serverless-Authorization'] = `Bearer ${identityToken}`;
  }

  if (appToken) {
    headers.Authorization = `Bearer ${appToken}`;
  } else if (identityToken) {
    headers.Authorization = `Bearer ${identityToken}`;
  }

  if (body) {
    headers['content-type'] = 'application/json';
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

function tryGetGcloudIdentityToken() {
  if (process.env.STAGING_USE_IAM === 'false') {
    return undefined;
  }

  const attempts =
    process.platform === 'win32'
      ? [
          { command: 'gcloud.cmd', args: ['auth', 'print-identity-token'] },
          { command: 'gcloud', args: ['auth', 'print-identity-token'] },
          { command: 'cmd.exe', args: ['/c', 'gcloud', 'auth', 'print-identity-token'] }
        ]
      : [{ command: 'gcloud', args: ['auth', 'print-identity-token'] }];

  for (const attempt of attempts) {
    try {
      return execFileSync(attempt.command, attempt.args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      // Try the next platform-specific command name.
    }
  }

  return undefined;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
