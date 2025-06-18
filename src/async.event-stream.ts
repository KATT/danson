import {
	delimiterAggregator,
	deserializeAsync,
	serializeAsync,
	SerializeAsyncOptions,
	SerializeAsyncYield,
} from "./async.js";
import { Serialized } from "./utils.js";

const prefix = "data:";
type Prefix = typeof prefix;

type EventStreamEvent = `${Prefix}${string}\n\n`;

const prefixLength = prefix.length;

/**
 * Serialize an async iterable into a format that works to display with `text/event-stream`
 */
export function stringifyEventStream<T>(
	value: T,
	options?: SerializeAsyncOptions,
) {
	// The inner function is necessary to be able to coerce the return type
	return (async function* (): AsyncIterable<EventStreamEvent, void> {
		const iterator = serializeAsync(value, options);

		for await (const chunk of iterator) {
			yield `${prefix}${JSON.stringify(chunk)}\n\n`;
		}
	})() as Serialized<AsyncIterable<EventStreamEvent>, T>;
}

export async function parseEventStream<T>(
	value:
		| AsyncIterable<string, void>
		| Serialized<AsyncIterable<EventStreamEvent>, T>,
): Promise<T> {
	return deserializeAsync(eventStreamAggregator(value));
}

export async function* eventStreamAggregator(
	iterable: AsyncIterable<string, void>,
): AsyncIterable<SerializeAsyncYield, void> {
	const lines = delimiterAggregator(iterable, "\n\n");

	for await (const line of lines) {
		// remove prefix
		const json = line.slice(prefixLength);

		yield JSON.parse(json) as SerializeAsyncYield;
	}
}
