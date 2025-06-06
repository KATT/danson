import { createDeferred } from "./createDeferred.js";
import { mergeAsyncIterables } from "./mergeAsyncIterable.js";
import { ParseOptions, StringifyOptions } from "./utils.js";

type Branded<T, Brand> = T & { __brand: Brand };

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

type ChunkIndex = Branded<number, "chunkIndex">;
type ChunkStatus = Branded<number, "chunkStatus">;

export async function parseAsync<T>(
	value: AsyncIterable<string>,
	opts: ParseOptions = {},
): Promise<T> {
	const iterator = lineAggregator(value)[Symbol.asyncIterator]();
	const controllerMap = new Map<
		ChunkIndex,
		ReturnType<typeof createController>
	>();

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

	throw new Error("Not implemented");
}

export async function* stringifyAsync(
	value: unknown,
	options: StringifyOptions = {},
) {
	const chunkIndex = 0 as ChunkIndex;

	const mergedIterables =
		mergeAsyncIterables<[ChunkIndex, ChunkStatus, string]>();

	throw new Error("Not implemented");
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
