import { UnexpectedDefect } from '@arki/failure';
import { CLOCK_ERROR_CODES, ClockError, SleepCancelled } from './errors.js';
/** The longest delay every runtime's `setTimeout` honors (2^31 - 1 ms, about 24.8 days). */
export const MAX_TIMER_MS = 2_147_483_647;
function assertDelay(method, ms) {
    if (Number.isFinite(ms) && ms >= 0 && ms <= MAX_TIMER_MS)
        return;
    throw new ClockError(CLOCK_ERROR_CODES.invalidDelay, `${method} requires a finite delay from 0 to ${String(MAX_TIMER_MS)} milliseconds, received ${String(ms)}`, 'Pass a finite number of milliseconds that is zero or more and fits in a timer.');
}
/** One `sleep` for every clock, built on its `setTimer`. */
async function sleepOn(clock, ms, signal) {
    // Invalid timer definitions are programmer misuse; operational provider faults below are owned here.
    assertDelay('Clock.sleep', ms);
    return new Promise(resolve => {
        let cancel;
        const state = { settled: false, registering: false, pending: false };
        let listenerAttached = false;
        let pendingOutcome;
        const finish = (outcome) => {
            if (state.settled)
                return;
            if (state.registering) {
                if (!state.pending)
                    pendingOutcome = outcome;
                state.pending = true;
                return;
            }
            state.settled = true;
            let result = outcome;
            const pendingCleanup = [];
            const observeCleanup = (cleanup) => {
                if (cleanup === undefined)
                    return;
                pendingCleanup.push(Promise.resolve(cleanup).then(() => { }, (error) => { result = UnexpectedDefect({ cause: error }); }));
            };
            try {
                if (listenerAttached)
                    observeCleanup(signal?.removeEventListener('abort', onAbort));
            }
            catch (error) {
                result = UnexpectedDefect({ cause: error });
            }
            try {
                observeCleanup(cancel?.());
            }
            catch (error) {
                result = UnexpectedDefect({ cause: error });
            }
            if (pendingCleanup.length === 0)
                resolve(result);
            else
                void Promise.all(pendingCleanup).then(() => resolve(result));
        };
        const onAbort = () => {
            try {
                finish(SleepCancelled({ cause: signal?.reason }));
            }
            catch (error) {
                finish(UnexpectedDefect({ cause: error }));
            }
        };
        try {
            if (signal?.aborted) {
                onAbort();
                return;
            }
            if (signal !== undefined) {
                listenerAttached = true;
                const registration = signal.addEventListener('abort', onAbort, { once: true });
                if (registration !== undefined) {
                    // A late registration rejection is observed, but cannot undo completed sleep.
                    void Promise.resolve(registration).catch((error) => finish(UnexpectedDefect({ cause: error })));
                }
                if (signal.aborted)
                    onAbort();
            }
            if (state.settled)
                return;
            state.registering = true;
            const registered = clock.setTimer(() => finish(), ms);
            if (typeof registered !== 'function') {
                // A malformed JS provider may return a rejecting promise instead of a handle.
                void Promise.resolve(registered).catch(() => { });
                throw new TypeError('Clock.setTimer must return a cancellation function');
            }
            cancel = registered;
            state.registering = false;
            // A foreign clock may invoke the callback synchronously before returning its cancellation handle.
            if (state.pending)
                finish(pendingOutcome);
        }
        catch (error) {
            state.registering = false;
            finish(UnexpectedDefect({ cause: error }));
        }
    });
}
/**
 * Default production `Clock`, backed by the runtime `Date` and `setTimeout`.
 */
export class SystemClock {
    now() {
        return new Date();
    }
    setTimer(callback, ms) {
        assertDelay('SystemClock.setTimer', ms);
        const id = setTimeout(callback, ms);
        return () => {
            clearTimeout(id);
        };
    }
    sleep(ms, signal) {
        return sleepOn(this, ms, signal);
    }
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
export class MockClock {
    #currentMs;
    #timers = [];
    #nextOrder = 0;
    constructor(initialNow = new Date(0)) {
        this.#currentMs = initialNow.getTime();
    }
    now() {
        return new Date(this.#currentMs);
    }
    setTimer(callback, ms) {
        assertDelay('MockClock.setTimer', ms);
        const timer = { due: this.#currentMs + ms, order: this.#nextOrder++, callback };
        this.#timers.push(timer);
        return () => {
            const index = this.#timers.indexOf(timer);
            if (index !== -1)
                this.#timers.splice(index, 1);
        };
    }
    sleep(ms, signal) {
        return sleepOn(this, ms, signal);
    }
    /**
     * Moves time forward by `ms` and fires, in time order, every timer due by
     * then, each at its own due time. A timer that a firing callback sets is
     * fired too when it comes due within the step. Synchronous: code that resumes
     * after an `await` runs only after `advance` returns, so use
     * {@link MockClock.advanceAsync} for timers that async code sets.
     */
    advance(ms) {
        const target = this.#target('advance', ms);
        for (let timer = this.#takeDue(target); timer !== undefined; timer = this.#takeDue(target)) {
            this.#fire(timer);
        }
        this.#currentMs = target;
    }
    /**
     * Like {@link MockClock.advance}, but lets state.pending promise callbacks run
     * before the first timer and after each fired timer. So a timer that async
     * code sets after an `await` (a retry loop's next `sleep`, say) also fires
     * when it comes due within the step. To let them run it waits for one real
     * macrotask (`setTimeout(0)`) each time, so do not combine it with fake timers
     * that replace `setTimeout`.
     */
    async advanceAsync(ms) {
        const target = this.#target('advanceAsync', ms);
        await nextMacrotask();
        for (let timer = this.#takeDue(target); timer !== undefined; timer = this.#takeDue(target)) {
            this.#fire(timer);
            await nextMacrotask();
        }
        this.#currentMs = target;
    }
    setNow(date) {
        this.#currentMs = date.getTime();
    }
    #target(method, ms) {
        if (!Number.isFinite(ms) || ms < 0) {
            throw new ClockError(CLOCK_ERROR_CODES.invalidAdvance, `MockClock.${method} requires a finite non-negative number of milliseconds, received ${String(ms)}`, 'Pass a finite number of milliseconds that is zero or more. To go back in time, call setNow.');
        }
        return this.#currentMs + ms;
    }
    /** Removes and returns the earliest timer due by `target`, or `undefined` when none is. */
    #takeDue(target) {
        let earliest;
        for (const timer of this.#timers) {
            if (timer.due > target)
                continue;
            if (earliest === undefined ||
                timer.due < earliest.due ||
                (timer.due === earliest.due && timer.order < earliest.order))
                earliest = timer;
        }
        if (earliest !== undefined)
            this.#timers.splice(this.#timers.indexOf(earliest), 1);
        return earliest;
    }
    #fire(timer) {
        if (timer.due > this.#currentMs)
            this.#currentMs = timer.due;
        timer.callback();
    }
}
/** Resolves after one real macrotask, so every state.pending promise callback has run. */
function nextMacrotask() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}
//# sourceMappingURL=clock.js.map