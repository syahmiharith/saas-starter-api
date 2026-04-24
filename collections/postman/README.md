# Postman Collection

Import `saas-starter-api.postman_collection.json` into Postman and run requests in order.

The collection defaults to the public staging API:

```txt
https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app
```

For local development, set the collection variable `baseUrl` to:

```txt
http://localhost:3000
```

Notes:

- `Register Owner` stores `accessToken`, `refreshToken`, and `organizationId`.
- `Create API Key` stores the one-time API key secret.
- `Track API Usage` uses `x-api-key`.
- `Login Admin` requires setting `adminEmail` and `adminPassword` collection variables first.
- The public staging demo uses Stripe test mode.
