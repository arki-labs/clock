import { defineFailure, UnexpectedDefect } from '@arki/failure';
/**
 * Static timer configuration misuse raises {@link ClockError}. Sleep operational
 * outcomes are canonical failure values. Match definitions or codes, never messages.
 */
/** Stable error codes of `@arki/clock`. */
export const CLOCK_ERROR_CODES = {
    /**
     * `MockClock.advance` or `advanceAsync` got a negative or non-finite number of milliseconds.
     *
     * @fix Pass a step that is zero or more. Use `setNow` to move the mock clock back.
     * @verify bun run test
     */
    invalidAdvance: 'ARKI_CLOCK_E001',
    /**
     * `setTimer` or `sleep` got a delay that is negative, not finite, or longer than a timer can hold.
     *
     * @fix Pass a finite delay from 0 up to `MAX_TIMER_MS` (about 24.8 days). Split a longer wait into steps.
     * @verify bun run test
     */
    invalidDelay: 'ARKI_CLOCK_E002',
};
/** A coded failure of a clock. */
export class ClockError extends Error {
    code;
    /** What to do about it, in one sentence. */
    remediation;
    constructor(code, message, remediation, options) {
        super(`${code}: ${message}`, options);
        this.name = 'ClockError';
        this.code = code;
        this.remediation = remediation;
    }
}
/** A sleep ended before its timer because its owner cancelled it.
 * @fix Handle cancellation at the owning operation boundary.
 * @verify bun run test
 */
export const SleepCancelled = defineFailure('clock.sleep_cancelled', {
    status: 499,
    message: 'Sleep was cancelled before it finished.',
    remediation: 'Handle cancellation at the owning operation boundary.',
});
/** Exact canonical failure definitions returned by Clock.sleep. */
export const SLEEP_FAILURES = [SleepCancelled, UnexpectedDefect];
//# sourceMappingURL=errors.js.map