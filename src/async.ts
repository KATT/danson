import { createDeferred } from "./createDeferred.js";
import { mergeAsyncIterables } from "./mergeAsyncIterable.js";
import {
	DeserializeInternalOptions,
	DeserializeOptions,
	DeserializerRecord,
	deserializeSync,
	SerializeOptions,
	SerializeRecord,
	SerializeReturn,
	serializeSync,
	StringifyOptions,
} from "./sync.js";
import {
	Branded,
	counter,
	CounterFn,
	INTERNAL_OPTIONS_SYMBOL,
	Serialized,
} from "./utils.js";

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

export interface SerializeAsyncOptions
	extends Omit<SerializeOptions, "internal"> {
	/**
	 * If an error is encountered when serializing e.g. a rejected `Promise`, we use this function to coerce it to a value that can be serialized.
	 *
	 * If no function is provided, the error will be thrown.
	 * @default undefined
	 */
	coerceError?: (cause: unknown) => unknown;
}

type SerializeAsyncChunk = [ChunkIndex, ChunkStatus, SerializeReturn];

export type SerializeAsyncYield =
	// yielded chunks
	| SerializeAsyncChunk
	// First chunk
	| SerializeReturn;

/**
 * Serializes a value into an intermediate format asynchronously.
 * This is a low-level function used internally by `stringifyAsync` but can be useful for custom serialization pipelines.
 * Handles async values like Promises, AsyncIterables, and ReadableStreams.
 * @param value The value to serialize
 * @param options Serialization options
 * @returns An async iterable that yields serialized chunks
 */
export function serializeAsync<T>(
	value: T,
	options: SerializeAsyncOptions = {},
) {
	/* eslint-disable perfectionist/sort-objects */
	const serializers: SerializeRecord = {
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
							yield [ASYNC_ITERABLE_STATUS_RETURN, serialize(next.value)];
							break;
						}
						yield [ASYNC_ITERABLE_STATUS_YIELD, serialize(next.value)];
					}
				} catch (cause) {
					yield [ASYNC_ITERABLE_STATUS_ERROR, serialize(cause)];
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
							yield [ASYNC_ITERABLE_STATUS_RETURN, serialize(next.value)];
							break;
						}
						yield [ASYNC_ITERABLE_STATUS_YIELD, serialize(next.value)];
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
					yield [PROMISE_STATUS_FULFILLED, serialize(next)];
				} catch (cause) {
					yield [PROMISE_STATUS_REJECTED, safeCause(cause)];
				}
			});
		},
	};
	const opts = {
		...options,
		[INTERNAL_OPTIONS_SYMBOL]: {
			indexCounter: counter(),
			indexToRefRecord: {},
			knownDuplicates: new Set(),
			refCounter: counter(),
		},
		serializers: {
			...options.serializers,
			...serializers,
		},
	} satisfies SerializeOptions;

	const chunkIndexCounter = counter<"chunkIndex">();

	function serialize(value: unknown): SerializeReturn {
		return serializeSync(value, opts);
	}

	const mergedIterables = mergeAsyncIterables<SerializeAsyncChunk>();

	function registerAsync(
		callback: () => AsyncIterable<[ChunkStatus, SerializeReturn]>,
	) {
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
	/* eslint-enable perfectionist/sort-objects */

	function safeCause(cause: unknown) {
		try {
			return serialize(cause);
		} catch (err) {
			if (!options.coerceError) {
				throw err;
			}
			return serialize(options.coerceError(cause));
		}
	}

	// The inner function is necessary to be able to coerce the return type
	return (async function* (): AsyncIterable<SerializeAsyncYield, void> {
		yield serialize(value);

		for await (const item of mergedIterables) {
			yield item;
		}
	})() as Serialized<AsyncIterable<SerializeAsyncYield>, T>;
}

export interface StringifyAsyncOptions
	extends SerializeAsyncOptions,
		StringifyOptions {
	//
}

/**
 * Serializes a value into a JSON string stream asynchronously.
 * Use this when you need to handle async values or want to process the stream asynchronously.
 * @param value The value to serialize
 * @param options Serialization options
 * @returns An async iterable that yields JSON string chunks
 */
export function stringifyAsync<T>(
	value: T,
	options: StringifyAsyncOptions = {},
) {
	// The inner function is necessary to be able to coerce the return type
	return (async function* (): AsyncIterable<string, void> {
		const iterator = serializeAsync(value, options);

		for await (const item of iterator) {
			yield JSON.stringify(item, null, options.space) + "\n";
		}
	})() as Serialized<AsyncIterable<string>, T>;
}

export type DeserializeAsyncOptions = Omit<DeserializeOptions, "internal">;

/**
 * Deserializes from an intermediate format asynchronously.
 * This is a low-level function used internally by `parseAsync` but can be useful for custom deserialization pipelines.
 * @param iterable The async iterable of serialized chunks to deserialize
 * @param options Deserialization options
 * @returns A promise that resolves to the deserialized value
 */
export async function deserializeAsync<T>(
	iterable:
		| AsyncIterable<SerializeAsyncYield, void>
		| Serialized<AsyncIterable<SerializeAsyncYield>, T>,
	options: DeserializeAsyncOptions = {},
): Promise<T> {
	const iterator = iterable[Symbol.asyncIterator]();
	const controllerMap = new Map<
		ChunkIndex,
		ReturnType<typeof createController>
	>();
	const internal: DeserializeInternalOptions = {
		cache: new Map(),
	};

	/* eslint-disable perfectionist/sort-objects */
	const deserializers: DeserializerRecord = {
		...options.deserializers,

		ReadableStream(idx) {
			const c = getController(idx as ChunkIndex);

			const iterable = c.generator();

			return new ReadableStream({
				async cancel() {
					await iterable.return();
				},
				async pull(controller) {
					const result = await iterable.next();

					if (result.done) {
						controller.close();
						return;
					}
					const [status, value] = result.value;
					switch (status) {
						case ASYNC_ITERABLE_STATUS_RETURN:
							controller.close();
							break;
						case ASYNC_ITERABLE_STATUS_YIELD:
							controller.enqueue(value);
							break;
						case ASYNC_ITERABLE_STATUS_ERROR:
							throw value;
						default:
							// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
							throw new Error(`Unknown async iterable status: ${status}`);
					}
				},
			});
		},
		async *AsyncIterable(idx) {
			const c = getController(idx as ChunkIndex);

			for await (const item of c.generator()) {
				const [status, value] = item;
				switch (status) {
					case ASYNC_ITERABLE_STATUS_RETURN:
						return value;
					case ASYNC_ITERABLE_STATUS_YIELD:
						yield value;
						break;
					case ASYNC_ITERABLE_STATUS_ERROR:
						throw value;
				}
			}
		},
		Promise(idx) {
			const c = getController(idx as ChunkIndex);

			const promise = (async () => {
				for await (const item of c.generator()) {
					const [status, value] = item;
					switch (status) {
						case PROMISE_STATUS_FULFILLED:
							return value;
						case PROMISE_STATUS_REJECTED:
							throw value;
						default:
							// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
							throw new Error(`Unknown promise status: ${status}`);
					}
				}
			})();

			promise.catch(() => {
				// prevent unhandled promise rejection warnings
			});

			return promise;
		},
	};
	/* eslint-enable perfectionist/sort-objects */
	const opts: Required<DeserializeOptions> = {
		deserializers: {
			...options.deserializers,
			...deserializers,
		},
		internal,
	};

	function createController(id: ChunkIndex) {
		let deferred = createDeferred();
		type Chunk = [ChunkStatus, unknown] | Error;
		const buffer: Chunk[] = [];

		async function* generator() {
			try {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				while (true) {
					await deferred.promise;
					deferred = createDeferred();

					while (buffer.length) {
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						const value = buffer.shift()!;
						if (value instanceof Error) {
							throw value;
						}
						yield value;
					}
				}
			} finally {
				controllerMap.delete(id);
			}
		}

		return {
			generator,
			push: (v: Chunk) => {
				buffer.push(v);
				deferred.resolve();
			},
		};
	}

	function getController(id: ChunkIndex) {
		const c = controllerMap.get(id);
		if (!c) {
			const queue = createController(id);
			controllerMap.set(id, queue);
			return queue;
		}
		return c;
	}

	function cleanup(cause?: unknown) {
		for (const [, enqueue] of controllerMap) {
			enqueue.push(
				cause instanceof Error
					? cause
					: new Error("Stream interrupted", { cause }),
			);
		}
		iterator.return?.().catch(() => {
			// prevent unhandled promise rejection warnings
			// todo: do something?
		});
	}

	function deserialize<TShape>(value: SerializeReturn) {
		return deserializeSync<TShape>(value, opts);
	}

	const head = (await iterator.next()) as IteratorResult<SerializeReturn, void>;

	const headValue = deserialize<T>(head.value as SerializeReturn);

	(async () => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		while (true) {
			const result = (await iterator.next()) as IteratorResult<
				SerializeAsyncChunk,
				void
			>;
			if (result.done) {
				break;
			}
			const [idx, status, obj] = result.value;

			getController(idx).push([status, deserialize(obj)]);
		}
		// if we get here, we've finished the stream, let's go through all the enqueue map and enqueue a stream interrupt error
		// this will only happen if receiving a malformatted stream
		cleanup();
	})().catch((cause: unknown) => {
		// go through all the asyncMap and enqueue the error
		cleanup(cause);
	});

	return headValue;
}

/**
 * Deserializes a JSON stream into a value asynchronously.
 * Use this when you need to handle async values or want to process the stream asynchronously.
 * @param value The async iterable of JSON strings to deserialize
 * @param options Deserialization options
 * @returns A promise that resolves to the deserialized value
 */
export function parseAsync<T>(
	value: AsyncIterable<string, void> | Serialized<AsyncIterable<string>, T>,
	options: DeserializeAsyncOptions = {},
): Promise<T> {
	return deserializeAsync(jsonAggregator(value), options);
}

async function* lineAggregator(iterable: AsyncIterable<string>) {
	let buffer = "";

	for await (const chunk of iterable) {
		buffer += chunk;

		let index: number;
		while ((index = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, index);
			buffer = buffer.slice(index + 1);
			yield line;
		}
	}
}

/**
 * Parse a stream of json objects from a stream of lines.
 * The json objects can be pretty-printed, so we need to aggregate the lines
 * until we get a complete json object.
 */
async function* jsonAggregator(
	iterable: AsyncIterable<string>,
): AsyncIterable<SerializeAsyncYield, void> {
	let linesBuffer: string[] = [];

	for await (const line of lineAggregator(iterable)) {
		linesBuffer.push(line);

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const firstLine = linesBuffer.at(0)!;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const lastLine = linesBuffer.at(-1)!;

		if (
			// non-pretty-printed json
			(firstLine.startsWith("{") && firstLine.endsWith("}")) ||
			(firstLine.startsWith("[") && firstLine.endsWith("]")) ||
			// pretty-printed json
			(firstLine === "{" && lastLine === "}") ||
			(firstLine === "[" && lastLine === "]")
		) {
			const buf = linesBuffer.join("\n");
			linesBuffer = [];
			yield JSON.parse(buf);
		}
	}
}
