export type CleanErrorCode = 'INVALID_INPUT' | 'PARSE_FAILED' | 'ENCRYPTED' | 'ABORTED';

export class CleanError extends Error {
  readonly code: CleanErrorCode;

  constructor(code: CleanErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CleanError';
    this.code = code;
  }
}
