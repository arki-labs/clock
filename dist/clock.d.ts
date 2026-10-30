import type { SleepFailure } from './errors.js';
/** The longest delay every runtime's `setTimeout` honors (2^31 - 1 ms, about 24.8 days). */
export declare const MAX_TIMER_MS = 2147483647;
/**
 * Time-source abstraction — the single boundary where
 * "what time is it?" and "wake me later" are answered.
 *
 * Inject a `Clock` wherever code needs the current time or a timer, so tests can
 * swap in `MockClock` and run long waits (retry delays, cooling windows, daily
 * crons) instantly and deterministically.
 */
export type Clock = {
    now(): Date;
    /**
     * Calls `callback` once, `ms` milliseconds from now. Returns a function that
     * cancels the timer; calling it after the timer fired does nothing. Throws
     * `ClockError` (`ARKI_CLOCK_E002`) when `ms` is negative, not finite, or above
     * {@link MAX_TIMER_MS}.
     */
    setTimer(callback: () => void, ms: number): () => void;
    /**
     * Resolves `ms` milliseconds from now. Aborting `signal` clears the timer and
     * returns `SleepCancelled` whose private `cause` is `signal.reason`;
     * an already-aborted signal returns it at once. An invalid `ms` rejects with
     * `ClockError` (`ARKI_CLOCK_E002`).
     */
    sleep(ms: number, signal?: AbortSignal): Promise<void | SleepFailure>;
};
/**
 * Default production `Clock`, backed by the runtime `Date` and `setTimeout`.
 */
export declare class SystemClock implements Clock {
    now(): Date;
    setTimer(callback: () => void, ms: number): () => void;
    sleep(ms: number, signal?: AbortSignal): Promise<void | SleepFailure>;
}
/**
 * Controllable `Clock` for tests.
 *
 * Design choices:
 * - `now()` returns a fresh `Date` on every call so callers mutating the
 *   returned value cannot corrupt clock state (`Date` is mutable in JS).
 * - Timers never fire on their own. `advance(ms)` moves time forward and fires
 *   every timer that comes due, in time order, at its own due time.
 * - `advance(ms)` moves time forward only; negative or non-finite values
 *   throw `ClockError` (`ARKI_CLOCK_E001`). Silent backward drift tends to mask test bugs.
 * - `setNow(date)` sets absolute time and is allowed to go backward — this
 *   is the escape hatch for tests that need to arrange a past scenario. It
 *   fires no timers.
 */
export declare class MockClock implements Clock {
    #private;
    constructor(initialNow?: Date);
    now(): Date;
    setTimer(callback: () => void, ms: number): () => void;
    sleep(ms: number, signal?: AbortSignal): Promise<void | SleepFailure>;
    /**
     * Moves time forward by `ms` and fires, in time order, every timer due by
     * then, each at its own due time. A timer that a firing callback sets is
     * fired too when it comes due within the step. Synchronous: code that resumes
     * after an `await` runs only after `advance` returns, so use
     * {@link MockClock.advanceAsync} for timers that async code sets.
     */
    advance(ms: number): void;
    /**
     * Like {@link MockClock.advance}, but lets state.pending promise callbacks run
     * before the first timer and after each fired timer. So a timer that async
     * code sets after an `await` (a retry loop's next `sleep`, say) also fires
     * when it comes due within the step. To let them run it waits for one real
     * macrotask (`setTimeout(0)`) each time, so do not combine it with fake timers
     * that replace `setTimeout`.
     */
    advanceAsync(ms: number): Promise<void>;
    setNow(date: Date): void;
}
//# sourceMappingURL=clock.d.ts.map