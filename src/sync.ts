/* eslint-disable @typescript-eslint/restrict-template-expressions */

/**
 * We're making a json stringifier that can be used to serialize and deserialize data.
 */

import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
	JsonArray,
	JsonObject,
	JsonPrimitive,
	JsonValue,
} from "./utils.js";

type $1LikeString = `$${string}`;
const $1LikeStringRegex = /^\$\d+$/;
function is$1LikeString(thing: unknown): thing is $1LikeString {
	return typeof thing === "string" && $1LikeStringRegex.test(thing);
}

type Index = ReturnType<CounterFn<"index">>;
type Chunk = { index: Index } & (
	| {
			name: ReducerName;
			type: "custom";
			value: Chunk;
	  }
	| {
			type: "$1-like-string";
			value: $1LikeString;
	  }
	| {
			type: "array";
			value: Chunk[];
	  }
	| {
			type: "object";
			value: Record<string, Chunk>;
	  }
	| {
			type: "primitive";
			value: JsonPrimitive;
	  }
	| {
			type: "ref";
	  }
);
type ReducerName = Branded<string, "reducer">;

type RefId = ReturnType<CounterFn<"ref">>;

type TailValueReducer = [RefId, ReducerName, JsonValue];
type TailValueRef = [RefId, JsonValue];
type TailValue = TailValueReducer | TailValueRef;
type TailList = TailValue[];
type TailRecord = Record<RefId, TailValue>;

export interface SerializeOptions {
	coerceError?: (cause: unknown) => unknown;
	reducers?: Record<
		string,
		(value: unknown) => Exclude<JsonValue, boolean> | false
	>;
}

export function serializeSync(value: unknown, options: SerializeOptions = {}) {
	const reducers = options.reducers ?? {};
	const values = new Map<unknown, Index>();

	const badReducerNames = Object.keys(reducers).filter((name) =>
		name.startsWith("_"),
	);
	if (badReducerNames.length > 0) {
		throw new Error(
			`Reducer names cannot start with "_": ${badReducerNames.join(", ")}`,
		);
	}

	const incrementIndex = counter<"index">();

	const knownDuplicates = new Set<Index>();

	function introspect(thing: unknown): Chunk {
		const existing = values.get(thing);
		if (existing !== undefined) {
			knownDuplicates.add(existing);

			return {
				index: existing,
				type: "ref",
			};
		}
		const index = incrementIndex();
		values.set(thing, index);

		for (const [name, fn] of Object.entries(reducers)) {
			const value = fn(thing);
			if (value === false) {
				continue;
			}

			return {
				index,
				name: name as ReducerName,
				type: "custom",
				value: introspect(value),
			};
		}

		if (isJsonPrimitive(thing)) {
			if (is$1LikeString(thing)) {
				// special handling - things like "$1"
				return {
					index,
					type: "$1-like-string",
					value: thing,
				};
			}
			return {
				index,
				type: "primitive",
				value: thing,
			};
		}

		if (isPlainObject(thing)) {
			return {
				index,
				type: "object",
				value: Object.fromEntries(
					Object.entries(thing).map(([key, value]) => [key, introspect(value)]),
				),
			};
		}

		if (Array.isArray(thing)) {
			return {
				index,
				type: "array",
				value: thing.map(introspect),
			};
		}

		throw new Error("unimplemented");
	}

	const refCounter = counter<"ref">();
	const refToIndexRecord: Record<Index, RefId> = {};
	function getRefIdForIndex(index: Index): RefId {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return 0 as RefId;
		}
		if (refToIndexRecord[index]) {
			return refToIndexRecord[index];
		}
		refToIndexRecord[index] = refCounter();
		return refToIndexRecord[index];
	}

	function toJson(chunk: Chunk, force: boolean): [JsonValue, TailRecord] {
		if (chunk.type === "ref") {
			const refId = getRefIdForIndex(chunk.index);
			return [`$${refId}`, {}];
		}
		if (knownDuplicates.has(chunk.index) && !force) {
			const [head, tail] = toJson(chunk, true);

			const refId = getRefIdForIndex(chunk.index);
			return [
				`$${refId}`,
				{
					[refId]: [refId, head],
					...tail,
				},
			];
		}

		switch (chunk.type) {
			case "$1-like-string": {
				const refId = getRefIdForIndex(chunk.index);
				const head = chunk.value;
				const tail: TailValue = [refId, "_$" as ReducerName, head];
				return [
					head,
					{
						[refId]: tail,
					},
				];
			}
			case "array": {
				const parts = chunk.value.map((v) => toJson(v, false));

				const head: JsonArray = parts.map(([head]) => head);

				const tail: TailRecord = {};
				for (const [, t] of parts) {
					Object.assign(tail, t);
				}
				return [head, tail];
			}
			case "custom": {
				const refId = getRefIdForIndex(chunk.index);
				const [head, tail] = toJson(chunk.value, false);

				Object.assign(tail, {
					[refId]: [refId, chunk.name, head],
				});
				return [`$${refId}`, tail];
			}
			case "object": {
				const head: JsonObject = {};
				const tail: TailRecord = {};
				for (const [key, value] of Object.entries(chunk.value)) {
					const [h, t] = toJson(value, false);

					head[key] = h;
					Object.assign(tail, t);
				}
				return [head, tail];
			}
			case "primitive": {
				return [chunk.value, {}];
			}
		}
	}

	const chunk = introspect(value);

	const [head, tail] = toJson(chunk, true);
	return {
		chunk,
		head,
		tail,
	};
}

export interface DeserializeOptions {
	head: JsonValue;
	revivers?: Record<string, (value: unknown) => unknown>;
	tail: TailRecord;
}

export function tailListToRecord(tail: TailList): TailRecord {
	const result: TailRecord = {};
	for (const tailValue of tail) {
		const [refId] = tailValue;
		result[refId] = tailValue;
	}
	return result;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function deserializeSync<T>(options: DeserializeOptions): T {
	const revivers = options.revivers ?? {};
	const refMap = new Map<RefId, unknown>();

	let rootResult: unknown;

	function getTailValueResult(refId: RefId): unknown {
		if (refMap.has(refId)) {
			return refMap.get(refId);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tailValue = options.tail[refId]!;
		if (tailValue.length === 2) {
			const [, value] = tailValue;
			const result = deserializeValue(value);
			refMap.set(refId, result);
			return result;
		}
		const [, reducerName, value] = tailValue;
		const reviver = revivers[reducerName];
		if (!reviver) {
			throw new Error(`No reviver found for reducer: ${reducerName}`);
		}
		const result = reviver(value);
		refMap.set(refId, result);
		return result;
	}

	function deserializeValue(value: JsonValue, isRoot = false): unknown {
		if (is$1LikeString(value)) {
			const refId = Number(value.slice(1)) as RefId;
			// Special handling for self-referencing objects at top level
			if (refId === 0) {
				return rootResult;
			}
			return getTailValueResult(refId);
		}
		if (isJsonPrimitive(value)) {
			return value;
		}

		if (Array.isArray(value)) {
			const result: unknown[] = [];
			if (isRoot) {
				rootResult = result;
			}
			for (const it of value) {
				result.push(deserializeValue(it, isRoot));
			}
			return rootResult;
		}

		if (isPlainObject(value)) {
			const result: Record<string, unknown> = {};
			if (isRoot) {
				rootResult = result;
			}
			for (const [key, val] of Object.entries(value)) {
				result[key] = deserializeValue(val, isRoot);
			}
			return result;
		}

		return value;
	}

	return deserializeValue(options.head, true) as T;
}

const objectProtoNames = Object.getOwnPropertyNames(Object.prototype)
	.sort()
	.join("\0");
function isPlainObject(thing: unknown): thing is Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const proto = Object.getPrototypeOf(thing);

	return (
		proto === Object.prototype ||
		proto === null ||
		Object.getOwnPropertyNames(proto).sort().join("\0") === objectProtoNames
	);
}

/* eslint-enable @typescript-eslint/restrict-template-expressions */
