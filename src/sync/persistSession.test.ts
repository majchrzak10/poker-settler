import { describe, it, expect } from 'vitest';
import { isSessionConflictError } from './persistSession';

describe('isSessionConflictError', () => {
  it('matches the canonical RAISE EXCEPTION message', () => {
    expect(isSessionConflictError({ message: 'session_conflict' })).toBe(true);
  });

  it('matches when message contains session_conflict (e.g. wrapped by Supabase)', () => {
    expect(
      isSessionConflictError({ message: 'PostgresError: session_conflict at update_session_atomic' }),
    ).toBe(true);
  });

  it('matches by Postgres SQLSTATE P0001 alone', () => {
    expect(isSessionConflictError({ code: 'P0001' })).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isSessionConflictError({ message: 'forbidden' })).toBe(false);
    expect(isSessionConflictError({ message: 'session not found' })).toBe(false);
    expect(isSessionConflictError({ code: '23505' })).toBe(false);
  });

  it('handles null / undefined safely', () => {
    expect(isSessionConflictError(null)).toBe(false);
    expect(isSessionConflictError(undefined)).toBe(false);
    expect(isSessionConflictError({})).toBe(false);
  });
});
