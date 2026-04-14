// Auth0 configuration, loaded from environment variables.
// NEVER hardcode credentials. Use a .env file in development.

export interface Auth0Config {
  readonly domain: string
  readonly clientId: string
  readonly callbackUrl: string
  readonly logoutUrl: string
  readonly audience?: string
  readonly scopes: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function loadAuth0Config(): Auth0Config {
  return {
    domain: requireEnv('AUTH0_DOMAIN'),
    clientId: requireEnv('AUTH0_CLIENT_ID'),
    callbackUrl: process.env['AUTH0_CALLBACK_URL'] ?? 'psygil://callback',
    logoutUrl: process.env['AUTH0_LOGOUT_URL'] ?? 'psygil://logout',
    audience: process.env['AUTH0_AUDIENCE'] || undefined,
    scopes: process.env['AUTH0_SCOPES'] ?? 'openid profile email offline_access',
  }
}
