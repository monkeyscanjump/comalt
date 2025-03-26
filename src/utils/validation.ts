import { NextRequest } from 'next/server';

/**
 * Validate a request body using a validator function
 * Throws an error with proper API formatting if validation fails
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  validator: (body: any) => T
): Promise<T> {
  try {
    const body = await request.json();
    return validator(body);
  } catch (error) {
    // Rethrow with proper format for the errorResponse function to handle
    const validationError = new Error('Invalid request body');
    (validationError as any).code = 'INVALID_BODY';
    (validationError as any).status = 400;
    throw validationError;
  }
}

/**
 * Helper to check if a value exists
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} is required`);
    (error as any).code = 'MISSING_FIELD';
    (error as any).status = 400;
    (error as any).details = { field: fieldName };
    throw error;
  }
}

/**
 * Helper to validate field format using regex
 */
export function validateFormat(value: string, regex: RegExp, fieldName: string): void {
  if (!regex.test(value)) {
    const error = new Error(`Invalid ${fieldName} format`);
    (error as any).code = 'INVALID_FORMAT';
    (error as any).status = 400;
    (error as any).details = { field: fieldName };
    throw error;
  }
}
