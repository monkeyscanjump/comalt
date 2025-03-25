/**
 * Get an environment variable with type safety
 * @param key - The name of the environment variable
 * @param defaultValue - Optional default value if the environment variable is not set
 * @returns The value of the environment variable or the default value
 * @throws Error if no value is found and no default is provided
 */
export function getEnvVariable(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * Check if we're in production environment
 */
export const isProd = process.env.NODE_ENV === 'production';

/**
 * Check if we're in development environment
 */
export const isDev = process.env.NODE_ENV === 'development';

/**
 * Check if we're in test environment
 */
export const isTest = process.env.NODE_ENV === 'test';

/**
 * Get environment-specific configuration
 * @returns Configuration object based on current environment
 */
export function getEnvironmentConfig() {
  return {
    polkadotApiUrl: getEnvVariable('POLKADOT_API_URL', 'https://rpc.polkadot.io'),
    isDebugEnabled: !isProd,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  };
}

/**
 * Safely access a public environment variable (NEXT_PUBLIC_*)
 * These are safe to expose to the browser
 * @param key - The name of the environment variable (without NEXT_PUBLIC_ prefix)
 * @param defaultValue - Optional default value
 */
export function getPublicEnv(key: string, defaultValue?: string): string {
  // Next.js environment variable naming convention
  const fullKey = `NEXT_PUBLIC_${key}`;

  // Get value from Next.js environment (works in both server and client)
  const envValue = process.env[fullKey];

  // Return environment value if it exists, otherwise fallback to default
  return envValue || defaultValue || '';
}
