/**
 * Static timer configuration misuse raises {@link ClockError}. Sleep operational
 * outcomes are canonical failure values. Match definitions or codes, never messages.
 */
/** Stable error codes of `@arki/clock`. */
export declare const CLOCK_ERROR_CODES: {
    /**
     * `MockClock.advance` or `advanceAsync` got a negative or non-finite number of milliseconds.
     *
     * @fix Pass a step that is zero or more. Use `setNow` to move the mock clock back.
     * @verify bun run test
     */
    readonly invalidAdvance: 'ARKI_CLOCK_E001';
    /**
     * `setTimer` or `sleep` got a delay that is negative, not finite, or longer than a timer can hold.
     *
     * @fix Pass a finite delay from 0 up to `MAX_TIMER_MS` (about 24.8 days). Split a longer wait into steps.
     * @verify bun run test
     */
    readonly invalidDelay: 'ARKI_CLOCK_E002';
};
/** The code of a {@link ClockError}. */
export type ClockErrorCode = (typeof CLOCK_ERROR_CODES)[keyof typeof CLOCK_ERROR_CODES];
/** A coded failure of a clock. */
export declare class ClockError extends Error {
    readonly code: ClockErrorCode;
    /** What to do about it, in one sentence. */
    readonly remediation: string;
    constructor(code: ClockErrorCode, message: string, remediation: string, options?: ErrorOptions);
}
/** A sleep ended before its timer because its owner cancelled it.
 * @fix Handle cancellation at the owning operation boundary.
 * @verify bun run test
 */
export declare const SleepCancelled: import("@arki/failure").FailureDefinition<"clock.sleep_cancelled", undefined>;
/** Exact canonical failure definitions returned by Clock.sleep. */
export declare const SLEEP_FAILURES: readonly [import("@arki/failure").FailureDefinition<"clock.sleep_cancelled", undefined>, import("@arki/failure").FailureDefinition<"failure.unexpected_defect", undefined>];
/** Every operational outcome of Clock.sleep, inferred from its definitions. */
export type SleepFailure = ReturnType<(typeof SLEEP_FAILURES)[number]>;
//# sourceMappingURL=errors.d.ts.map