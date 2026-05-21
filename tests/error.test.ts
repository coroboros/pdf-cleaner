import { describe, expect, it } from 'vitest';
import { CleanError } from '../src/index.js';

describe('CleanError', () => {
  it('is an instance of Error', () => {
    const err = new CleanError('INVALID_INPUT', 'msg');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CleanError);
  });

  it('sets name to "CleanError"', () => {
    const err = new CleanError('INVALID_INPUT', 'msg');
    expect(err.name).toBe('CleanError');
  });

  it('stores the code', () => {
    const a = new CleanError('INVALID_INPUT', 'msg');
    const b = new CleanError('PARSE_FAILED', 'msg');
    expect(a.code).toBe('INVALID_INPUT');
    expect(b.code).toBe('PARSE_FAILED');
  });

  it('forwards the message', () => {
    const err = new CleanError('INVALID_INPUT', 'something specific');
    expect(err.message).toBe('something specific');
  });

  it('preserves Error.cause', () => {
    const inner = new Error('inner');
    const err = new CleanError('PARSE_FAILED', 'outer', { cause: inner });
    expect(err.cause).toBe(inner);
  });

  it('is JSON-serializable via name + code + message', () => {
    const err = new CleanError('INVALID_INPUT', 'msg');
    const data = { name: err.name, code: err.code, message: err.message };
    expect(JSON.stringify(data)).toContain('CleanError');
    expect(JSON.stringify(data)).toContain('INVALID_INPUT');
  });
});
