import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
	isPlainObject,
	JsonArray,
	JsonObject,
	JsonPrimitive,
	JsonValue,
} from "./utils.js";

export type RefLikeString = `$${number}`;

function isRefLikeString(thing: unknown): thing is RefLikeString {
	if (typeof thing !== "string" || thing.length < 2 || !thing.startsWith("$")) {
		return false;
	}
	for (let i = 1; i < thing.length; i++) {
		const char = thing.charCodeAt(i);
		// not 0-9
		if (char < 48 || char > 57) {
			return false;
		}
	}
	return true;
}

type Index = ReturnType<CounterFn<"index">>;

/**
 * Abstract Syntax Tree (AST)
 *
 * This is the internal representation of the data that we're serializing.
 * It's a tree of nodes that represent the data.
 *
 * The tree is constructed by the `introspect` function.
 *
 */
type AST = { index: Index } & (
	| {
			name: ReducerName;
			type: "custom";
			value: AST;
	  }
	| {
			type: "array";
			value: AST[];
	  }
	| {
			type: "object";
			value: Record<string, AST>;
	  }
	| {
			type: "primitive";
			value: JsonPrimitive;
	  }
	| {
			type: "ref";
	  }
	| {
			type: "ref-like-string";
			value: RefLikeString;
	  }
);
export type ReducerName = Branded<string, "reducer">;
export type ReducerFn = (value: unknown) => unknown;
export type ReducerRecord = Record<string, ReducerFn>;

export type RefIndex = ReturnType<CounterFn<"ref">>;

type Satisfies<T, U extends T> = U;

export type CustomValue = Satisfies<
	JsonObject,
	{
		_: "$"; // as it's a reserved string
		type: ReducerName;
		value: JsonValue;
	}
>;

type RefRecord = Record<RefLikeString, JsonValue>;

const reservedReducerNames = new Set(["string"]);

export function serializeSync(value: unknown, options: SerializeOptions = {}) {
	type Location = [parent: JsonArray | JsonObject, key: number | string] | null;

	const values = new Map<unknown, [Index, Location]>();
	const refs: RefRecord = {};
	const dupes = new Map<RefLikeString, Location>();

	const internal: SerializeInternalOptions = options.internal ?? {
		indexCounter: counter(),
		indexToRefRecord: {},
		knownDuplicates: new Set(),
		refCounter: counter(),
	};
	const reducers = options.reducers ?? {};

	for (const name of reservedReducerNames) {
		if (name in reducers) {
			throw new Error(`${name} is a reserved reducer name`);
		}
	}

	function toJson(thing: unknown, location: Location): JsonValue {
		const existing = values.get(thing);

		if (existing) {
			const [index, location] = existing;
			const refId: RefLikeString = getRefIdForIndex(index);

			dupes.set(refId, location);

			return refId;
		}
		const index = internal.indexCounter();
		values.set(thing, [index, location]);

		for (const name in reducers) {
			const fn = reducers[name];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const value = fn!(thing);
			if (value === false) {
				continue;
			}

			const customValue: CustomValue = {
				_: "$",
				type: name as ReducerName,
				value: 0,
			};

			customValue.value = toJson(value, [customValue, "value"]);

			return customValue;
		}

		if (isJsonPrimitive(thing)) {
			if (isRefLikeString(thing)) {
				const value: CustomValue = {
					_: "$",
					type: "string" as ReducerName,
					value: thing,
				};
				return value;
			}

			return thing;
		}

		if (isPlainObject(thing)) {
			const result: Record<string, JsonValue> = {};
			for (const key in thing) {
				result[key] = toJson(thing[key], [result, key]);
			}
			return result;
		}

		if (Array.isArray(thing)) {
			const result: JsonValue[] = [];
			for (const [index, it] of thing.entries()) {
				result.push(toJson(it, [result, index]));
			}
			return result;
		}

		// eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
		throw new Error(`Do not know how to serialize ${thing}`);
	}

	const indexToRefRecord: Record<Index, RefLikeString> = {};
	function getRefIdForIndex(index: Index): RefLikeString {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return "$0";
		}
		if (indexToRefRecord[index]) {
			return indexToRefRecord[index];
		}

		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		const refId: RefLikeString = `$${internal.refCounter()}`;
		indexToRefRecord[index] = refId;

		return refId;
	}

	const json = toJson(value, null);

	for (const [refId, location] of dupes) {
		if (!location) {
			continue;
		}

		const [parent, key] = location;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		const originalValue = parent[key as any] as JsonValue;

		// Replace with reference
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		(parent as any)[key] = refId;

		refs[refId] = originalValue;
	}

	return {
		json,
		refs: Object.keys(refs).length > 0 ? refs : undefined,
	};
}

export interface SerializeReturn {
	json: JsonValue;
	refs?: RefRecord;
}

export interface SerializeInternalOptions {
	indexCounter: CounterFn<"index">;
	indexToRefRecord: Record<Index, RefIndex>;
	knownDuplicates: Set<[Index, Location]>;
	refCounter: CounterFn<"ref">;
}

export interface SerializeOptions {
	coerceError?: (cause: unknown) => unknown;
	internal?: SerializeInternalOptions;
	reducers?: ReducerRecord;
}

export interface StringifyOptions extends SerializeOptions {
	space?: number | string;
}

export function stringifySync(value: unknown, options: StringifyOptions) {
	const result = serializeSync(value, options);

	return JSON.stringify(result, null, options.space);
}

export type ReviverFn<T> = (value: unknown) => T;
export interface RecursiveReviverFn<T> {
	create: () => T;
	set: (obj: T, value: unknown) => void;
}

export type Reviver<T> = RecursiveReviverFn<T> | ReviverFn<T>;

export type ReviverRecord = Record<string, Reviver<unknown>>;
export interface DeserializeOptions extends SerializeReturn {
	cache?: Map<RefLikeString, unknown>;
	revivers?: ReviverRecord;
}
export function deserializeSync<T>(options: DeserializeOptions): T {
	const revivers = options.revivers ?? {};
	const cache = options.cache ?? new Map<RefLikeString, unknown>();

	function getRefResult(refId: RefLikeString): unknown {
		if (cache.has(refId)) {
			return cache.get(refId);
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const refValue = options.refs![refId]!;

		const result = deserializeValue(refValue, refId);
		cache.set(refId, result);

		return result;
	}

	function deserializeValue(value: JsonValue, refId?: RefLikeString): unknown {
		if (isRefLikeString(value)) {
			return getRefResult(value);
		}
		if (isJsonPrimitive(value)) {
			return value;
		}

		if (Array.isArray(value)) {
			const result: unknown[] = [];
			if (refId) {
				cache.set(refId, result);
			}
			for (const it of value) {
				result.push(deserializeValue(it));
			}
			return result;
		}

		if (isPlainObject(value)) {
			if (value._ === "$") {
				const refValue = value as CustomValue;
				if (refValue.type === "string") {
					return refValue.value;
				}
				const reviver = revivers[refValue.type];
				if (!reviver) {
					throw new Error(`No reviver found for reducer: ${refValue.type}`);
				}
				if (typeof reviver === "function") {
					return reviver(deserializeValue(refValue.value));
				}
				const result = reviver.create();
				if (refId) {
					cache.set(refId, result);
				}
				reviver.set(result, deserializeValue(refValue.value));
				return result;
			}

			const result: Record<string, unknown> = {};
			if (refId) {
				cache.set(refId, result);
			}
			for (const [key, val] of Object.entries(value)) {
				result[key] = deserializeValue(val);
			}
			return result;
		}

		throw new Error("Deserializing unknown value");
	}

	const result = deserializeValue(options.json, "$0") as T;

	return result;
}

export interface ParseSyncOptions {
	revivers?: ReviverRecord;
}
export function parseSync<T>(value: string, options?: ParseSyncOptions) {
	const json = JSON.parse(value) as SerializeReturn;
	return deserializeSync<T>({
		...options,
		...json,
	});
}
