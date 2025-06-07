import { mergeAsyncIterables } from "./mergeAsyncIterable.js";
import {
	ReducerRecord,
	serializeSyncInternalOptions,
	StringifyOptions,
	stringifySyncInternal,
} from "./sync.js";
import { Branded, counter, CounterFn } from "./utils.js";

function chunkStatus<T extends number>(value: T): Branded<T, "chunkStatus"> {
	return value as Branded<T, "chunkStatus">;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return (
		typeof value === "object" && value !== null && Symbol.asyncIterator in value
	);
}

function isPromise(value: unknown): value is Promise<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		"then" in value &&
		typeof value.then === "function"
	);
}

const PROMISE_STATUS_FULFILLED = chunkStatus(0);
const PROMISE_STATUS_REJECTED = chunkStatus(1);

const ASYNC_ITERABLE_STATUS_YIELD = chunkStatus(0);
const ASYNC_ITERABLE_STATUS_ERROR = chunkStatus(1);
const ASYNC_ITERABLE_STATUS_RETURN = chunkStatus(2);

type ChunkIndex = ReturnType<CounterFn<"chunkIndex">>;
type ChunkStatus = Branded<number, "chunkStatus">;

export interface ParseAsyncOptions {
	reducers?: ReducerRecord;
}

export interface StringifyAsyncOptions extends StringifyOptions {
	coerceError?: (cause: unknown) => unknown;
}

export async function* stringifyAsync(
	value: unknown,
	options: StringifyAsyncOptions = {},
) {
	const chunkIndexCounter = counter<"chunkIndex">();
	/* eslint-disable perfectionist/sort-objects */
	const reducers: ReducerRecord = {
		...options.reducers,
		ReadableStream(v) {
			if (!(v instanceof ReadableStream)) {
				return false;
			}
			return registerAsync(async function* () {
				const reader = v.getReader();
				try {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					while (true) {
						const next = await reader.read();

						if (next.done) {
							yield [ASYNC_ITERABLE_STATUS_RETURN, stringify(next.value)];
							break;
						}
						yield [ASYNC_ITERABLE_STATUS_YIELD, stringify(next.value)];
					}
				} catch (cause) {
					yield [ASYNC_ITERABLE_STATUS_ERROR, safeCause(cause)];
				} finally {
					reader.releaseLock();
					await reader.cancel();
				}
			});
		},
		AsyncIterable(v) {
			if (!isAsyncIterable(v)) {
				return false;
			}
			return registerAsync(async function* () {
				const iterator = v[Symbol.asyncIterator]();
				try {
					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
					while (true) {
						const next = await iterator.next();
						if (next.done) {
							yield [ASYNC_ITERABLE_STATUS_RETURN, stringify(next.value)];
							break;
						}
						yield [ASYNC_ITERABLE_STATUS_YIELD, stringify(next.value)];
					}
				} catch (cause) {
					yield [ASYNC_ITERABLE_STATUS_ERROR, safeCause(cause)];
				} finally {
					await iterator.return?.();
				}
			});
		},
		Promise(v) {
			if (!isPromise(v)) {
				return false;
			}
			v.catch(() => {
				// prevent unhandled promise rejection
			});
			return registerAsync(async function* () {
				try {
					const next = await v;
					yield [PROMISE_STATUS_FULFILLED, stringify(next)];
				} catch (cause) {
					yield [PROMISE_STATUS_REJECTED, safeCause(cause)];
				}
			});
		},
	};
	const opts = serializeSyncInternalOptions({
		...options,
		reducers,
	});

	const mergedIterables =
		mergeAsyncIterables<[ChunkIndex, ChunkStatus, string]>();

	function registerAsync(callback: () => AsyncIterable<[ChunkStatus, string]>) {
		const idx = chunkIndexCounter();

		const iterable = callback();

		mergedIterables.add(
			(async function* () {
				for await (const item of iterable) {
					yield [idx, ...item];
				}
			})(),
		);

		return idx;
	}
	function stringify(value: unknown) {
		return stringifySyncInternal(value, opts).text;
	}

	/* eslint-enable perfectionist/sort-objects */

	function safeCause(cause: unknown) {
		try {
			return stringify(cause);
		} catch (err) {
			if (!options.coerceError) {
				throw err;
			}
			return stringify(options.coerceError(cause));
		}
	}

	yield stringify(value) + "\n";

	for await (const item of mergedIterables) {
		const [index, status, text] = item;
		yield `/* yield $${String(index)} */`;
		yield status;
		yield text;
	}
}
