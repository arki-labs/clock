/**
 * Time-source abstraction — the single boundary where
 * "what time is it?" is answered.
 *
 * Inject a `Clock` wherever code needs the current time so tests can swap in
 * `MockClock` and deterministically simulate long waits (cooling windows,
 * delayed gates, daily crons, regime-shift detection).
 */
export type Clock = {
    now(): Date;
};
/**
 * Default production `Clock`, backed by the runtime `Date`.
 */
export declare class SystemClock implements Clock {
    now(): Date;
}
/**
 * Controllable `Clock` for tests.
 *
 * Design choices:
 * - `now()` returns a fresh `Date` on every call so callers mutating the
 *   returned value cannot corrupt clock state (`Date` is mutable in JS).
 * - `advance(ms)` moves time forward only; negative or non-finite values
 *   throw `RangeError`. Silent backward drift tends to mask test bugs.
 * - `setNow(date)` sets absolute time and is allowed to go backward — this
 *   is the escape hatch for tests that need to arrange a past scenario.
 */
export declare class MockClock implements Clock {
    #private;
    constructor(initialNow?: Date);
    now(): Date;
    advance(ms: number): void;
    setNow(date: Date): void;
}
//# sourceMappingURL=clock.d.ts.map