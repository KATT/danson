/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
	isPlainObject,
	JsonObject,
	JsonPrimitive,
	JsonValue,
} from "./utils.js";

type RefLikeString = `$${number}`;
const refLikeStringRegex = /^\$\d+$/;
function isRefLikeString(thing: unknown): thing is RefLikeString {
	return typeof thing === "string" && refLikeStringRegex.test(thing);
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

export interface SerializeSyncInternalOptions extends SerializeOptions {
	indexCounter: CounterFn<"index">;
	indexToRefRecord: Record<Index, RefIndex>;
	knownDuplicates: Set<Index>;
	reducers: ReducerRecord;
	refCounter: CounterFn<"ref">;
}
export function serializeSyncInternal(
	value: unknown,
	options: SerializeSyncInternalOptions,
) {
	const values = new Map<unknown, Index>();

	for (const name of reservedReducerNames) {
		if (name in options.reducers) {
			throw new Error(`${name} is a reserved reducer name`);
		}
	}

	const knownDuplicates = new Set<Index>();

	function introspect(thing: unknown): AST {
		const existing = values.get(thing);
		if (existing !== undefined) {
			knownDuplicates.add(existing);

			return {
				index: existing,
				type: "ref",
			};
		}
		const index = options.indexCounter();
		values.set(thing, index);

		for (const [name, fn] of Object.entries(options.reducers)) {
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
			if (isRefLikeString(thing)) {
				// special handling - things like "$1"
				return {
					index,
					type: "ref-like-string",
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

		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		throw new Error(`Do not know how to serialize ${thing}`);
	}

	const indexToRefRecord: Record<Index, RefLikeString> = {};
	function getRefIdForIndex(index: Index): RefLikeString {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return "$0";
		}

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		indexToRefRecord[index] ??= `$${options.refCounter()}`;
		return indexToRefRecord[index];
	}

	const refs: RefRecord = {};
	function toJson(chunk: AST, force: boolean): JsonValue {
		if (chunk.type === "ref") {
			const refId = getRefIdForIndex(chunk.index);
			return refId;
		}
		if (knownDuplicates.has(chunk.index) && !force) {
			const refId = getRefIdForIndex(chunk.index);
			const json = toJson(chunk, true);

			refs[refId] = json;
			return refId;
		}

		switch (chunk.type) {
			case "array": {
				return chunk.value.map((v) => toJson(v, false));
			}
			case "custom": {
				const customValue: CustomValue = {
					_: "$",
					type: chunk.name,
					value: toJson(chunk.value, false),
				};

				return customValue;
			}
			case "object": {
				const json: JsonObject = {};
				for (const [key, value] of Object.entries(chunk.value)) {
					json[key] = toJson(value, false);
				}
				return json;
			}
			case "primitive": {
				return chunk.value;
			}
			case "ref-like-string": {
				const customValue: CustomValue = {
					_: "$",
					type: "string" as ReducerName,
					value: chunk.value,
				};

				return customValue;
			}
		}
	}

	const ast = introspect(value);

	const json = toJson(ast, true);

	return {
		ast,
		indexToRefRecord,
		json,
		knownDuplicates,
		refCounter: options.refCounter,
		refs: Object.keys(refs).length > 0 ? refs : undefined,
	};
}

export interface SerializeReturn {
	json: JsonValue;
	refs?: RefRecord;
}

export interface SerializeOptions {
	coerceError?: (cause: unknown) => unknown;
	reducers?: ReducerRecord;
}

export function serializeSyncInternalOptions<T extends SerializeOptions>(
	options: T,
): Omit<T, keyof SerializeSyncInternalOptions> & SerializeSyncInternalOptions {
	return {
		...options,
		indexCounter: counter(),
		indexToRefRecord: {},
		knownDuplicates: new Set(),
		reducers: options.reducers ?? {},
		refCounter: counter(),
	};
}

export function serializeSync(
	value: unknown,
	options: SerializeOptions = {},
): SerializeReturn {
	const result = serializeSyncInternal(
		value,
		serializeSyncInternalOptions(options),
	);
	return {
		json: result.json,
		refs: result.refs,
	};
}

export interface StringifyOptions extends SerializeOptions {
	space?: number | string;
}

export function stringifySync(value: unknown, options: StringifyOptions = {}) {
	const result = stringifySyncInternal(
		value,
		serializeSyncInternalOptions(options),
	);
	return result.text;
}

interface StringifySyncInternalOptions extends SerializeSyncInternalOptions {
	space?: number | string;
}
export function stringifySyncInternal(
	value: unknown,
	options: StringifySyncInternalOptions,
) {
	const result = serializeSyncInternal(value, options);

	return {
		...result,
		text: JSON.stringify(
			{
				json: result.json,
				refs: result.refs,
			},
			null,
			options.space,
		),
	};
}

export type ReviverFn = (value: unknown) => unknown;
export type ReviverRecord = Record<string, ReviverFn>;
export interface DeserializeOptions extends SerializeReturn {
	revivers?: ReviverRecord;
}

export function deserializeSync<T>(options: DeserializeOptions): T {
	const revivers = options.revivers ?? {};
	const refResult = new Map<RefLikeString, unknown>();
	const inProgress = new Set<RefLikeString>(["$0"]);
	const circularRefs = new Map<
		RefLikeString,
		{ count: number; symbol: unknown }
	>();

	function getRefResult(refId: RefLikeString): unknown {
		if (refResult.has(refId)) {
			return refResult.get(refId);
		}

		if (inProgress.has(refId)) {
			// Circular reference detected - increment count and return symbol
			if (!circularRefs.has(refId)) {
				circularRefs.set(refId, {
					count: 0,
					symbol: Symbol(`circular-${refId}`),
				});
			}
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const circularRef = circularRefs.get(refId)!;
			circularRef.count++;
			return circularRef.symbol;
		}

		inProgress.add(refId);

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const refValue = options.refs![refId]!;

		const result = deserializeValue(refValue, refId);
		refResult.set(refId, result);

		// Fix up any circular references
		if (circularRefs.has(refId)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const { count, symbol } = circularRefs.get(refId)!;
			replaceSymbolWithValue(result, {
				remainingCount: count,
				replacement: result,
				symbol,
			});
		}

		inProgress.delete(refId);
		return result;
	}

	function replaceSymbolWithValue(
		obj: unknown,
		options: {
			remainingCount: number;
			replacement: unknown;
			symbol: unknown;
		},
	): number {
		const { replacement, symbol } = options;
		let { remainingCount } = options;

		if (obj === symbol || remainingCount <= 0) {
			return remainingCount; // Can't replace the root object with itself, or we're done
		}

		if (Array.isArray(obj)) {
			for (let i = 0; i < obj.length && remainingCount > 0; i++) {
				if (obj[i] === symbol) {
					obj[i] = replacement;
					remainingCount--;
				} else if (typeof obj[i] === "object" && obj[i] !== null) {
					remainingCount = replaceSymbolWithValue(obj[i], {
						remainingCount,
						replacement,
						symbol,
					});
				}
			}
			return remainingCount;
		}
		if (obj instanceof Map) {
			// For Maps, we need to handle both keys and values that could be circular
			let hasSymbol = false;
			const newEntries: [unknown, unknown][] = [];

			for (const [key, value] of obj.entries()) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				let newKey = key;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				let newValue = value;

				if (key === symbol) {
					newKey = replacement;
					hasSymbol = true;
					remainingCount--;
				}

				if (value === symbol) {
					newValue = replacement;
					hasSymbol = true;
					remainingCount--;
				}

				newEntries.push([newKey, newValue]);

				// Recursively process key and value objects
				if (typeof key === "object" && key !== null && key !== symbol) {
					remainingCount = replaceSymbolWithValue(key, {
						remainingCount,
						replacement,
						symbol,
					});
				}

				if (typeof value === "object" && value !== null && value !== symbol) {
					remainingCount = replaceSymbolWithValue(value, {
						remainingCount,
						replacement,
						symbol,
					});
				}

				if (remainingCount <= 0) {
					break;
				}
			}

			// Rebuild the Map if we found symbols to preserve order
			if (hasSymbol) {
				obj.clear();
				for (const [key, value] of newEntries) {
					obj.set(key, value);
				}
			}

			return remainingCount;
		}
		if (obj instanceof Set) {
			// For Sets, we need to preserve order, so we rebuild if there are symbols
			let hasSymbol = false;
			const newValues: unknown[] = [];

			for (const value of obj.values()) {
				if (value === symbol) {
					newValues.push(replacement);
					hasSymbol = true;
					remainingCount--;
				} else {
					newValues.push(value);
					if (typeof value === "object" && value !== null) {
						remainingCount = replaceSymbolWithValue(value, {
							remainingCount,
							replacement,
							symbol,
						});
					}
				}
				if (remainingCount <= 0) {
					break;
				}
			}

			// Rebuild the Set if we found symbols to preserve order
			if (hasSymbol) {
				obj.clear();
				for (const value of newValues) {
					obj.add(value);
				}
			}

			return remainingCount;
		}
		if (isPlainObject(obj)) {
			for (const [key, value] of Object.entries(obj)) {
				if (remainingCount <= 0) {
					break;
				}
				if (value === symbol) {
					obj[key] = replacement;
					remainingCount--;
				} else if (typeof value === "object" && value !== null) {
					remainingCount = replaceSymbolWithValue(value, {
						remainingCount,
						replacement,
						symbol,
					});
				}
			}
			return remainingCount;
		}

		return remainingCount;
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
				refResult.set(refId, result);
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
				return reviver(deserializeValue(refValue.value));
			}

			const result: Record<string, unknown> = {};
			if (refId) {
				refResult.set(refId, result);
			}
			for (const [key, val] of Object.entries(value)) {
				result[key] = deserializeValue(val);
			}
			return result;
		}

		throw new Error("Deserializing unknown value");
	}

	const result = deserializeValue(options.json, "$0") as T;

	// Fix up any circular references in the root object
	if (circularRefs.has("$0")) {
		const { count, symbol } = circularRefs.get("$0")!;
		replaceSymbolWithValue(result, {
			remainingCount: count,
			replacement: result,
			symbol,
		});
	}

	inProgress.delete("$0");
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

/* eslint-enable @typescript-eslint/restrict-template-expressions */
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
