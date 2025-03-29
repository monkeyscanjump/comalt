export const isApiOnlyMode = process.env.APP_MODE === 'api-only';

export function ensureApiMode(handler: any) {
  // In API-only mode, all handlers work as normal
  if (isApiOnlyMode) {
    return handler;
  }

  // In full mode, API handlers also work normally
  return handler;
}

// Used in device pages to check if the UI should render
export function shouldRenderUI() {
  return !isApiOnlyMode;
}
