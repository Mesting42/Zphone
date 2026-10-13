/** Cooperative scheduling for independent imports; business state stays in app.js. */
export function yieldToBrowser() {
    return new Promise(function(resolve) { setTimeout(resolve, 0); });
}

export async function mapWithConcurrency(items, limit, operation) {
    const list = Array.from(items || []);
    const results = new Array(list.length);
    const requested = Number(limit);
    const workers = Math.min(list.length, Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1);
    let next = 0;
    let firstError = null;
    let failed = false;
    async function worker() {
        while (!failed && next < list.length) {
            const index = next++;
            try { results[index] = await operation(list[index], index); }
            catch (error) { if (!failed) { firstError = error; failed = true; } }
        }
    }
    // Drain in-flight operations before surfacing failure, so late callbacks
    // cannot change a UI that has already displayed the failure state.
    await Promise.all(Array.from({ length: workers }, worker));
    if (failed) throw firstError;
    return results;
}
