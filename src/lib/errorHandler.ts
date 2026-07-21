/**
 * Centralized error handler for production.
 * Never expose SQL details, RPC names, Postgres codes, or stack traces to users.
 * Log internally for debugging, show generic messages in the UI.
 */

const DEV = import.meta.env.DEV;

/**
 * Returns a user-safe error message.
 * In development, includes the original error for debugging.
 * In production, returns a generic message.
 */
export function getUserFacingErrorMessage(error: unknown, context?: string): string {
  const message = extractMessage(error);
  
  if (DEV) {
    return context ? `${context}: ${message}` : message;
  }
  
  return getFallbackMessage(context);
}

/**
 * Logs errors for internal monitoring without exposing details to users.
 */
export function logError(error: unknown, context: string): void {
  if (DEV) {
    console.error(`[${context}]`, error);
  } else {
    // In production, send to your monitoring service
    // e.g., Sentry, Datadog, or a custom endpoint
    // captureException(error, { tags: { context } });
    
    // Console error is acceptable in production for now
    // but should be replaced with a proper monitoring service
    console.error(`[${context}]`, error instanceof Error ? error.message : String(error));
  }
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg;
  }
  return 'An unexpected error occurred.';
}

function getFallbackMessage(context?: string): string {
  const messages: Record<string, string> = {
    auth: 'Authentication failed. Please try again.',
    profile: 'Could not load profile. Please refresh the page.',
    products: 'Could not process product data. Please try again.',
    upload: 'File upload failed. Please check the file and try again.',
    order: 'Could not process order. Please try again.',
    save: 'Could not save changes. Please try again.',
    delete: 'Could not delete. Please try again.',
    load: 'Could not load data. Please refresh the page.',
    default: 'Something went wrong. Please try again.',
  };
  
  return messages[context || 'default'] || messages.default;
}