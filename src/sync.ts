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
			const head = toJson(chunk, true);

			refs[refId] = head;
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
				const head: JsonObject = {};
				for (const [key, value] of Object.entries(chunk.value)) {
					head[key] = toJson(value, false);
				}
				return head;
			}
			case "primitive": {
				return chunk.value;
			}
			case "ref-like-string": {
				const head = chunk.value;
				const customValue: CustomValue = {
					_: "$",
					type: "string" as ReducerName,
					value: head,
				};

				return customValue;
			}
		}
	}

	const ast = introspect(value);

	const head = toJson(ast, true);

	return {
		ast,
		head,
		indexToRefRecord,
		knownDuplicates,
		refCounter: options.refCounter,
		refs,
	};
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

export function serializeSync(value: unknown, options: SerializeOptions = {}) {
	const result = serializeSyncInternal(
		value,
		serializeSyncInternalOptions(options),
	);
	return {
		head: result.head,
		tail: result.refs,
	};
}

export interface StringifyOptions extends SerializeOptions {
	space?: number;
}

export function stringifySync(value: unknown, options: StringifyOptions = {}) {
	const result = stringifySyncInternal(
		value,
		serializeSyncInternalOptions(options),
	);
	return result.text;
}

interface StringifySyncInternalOptions extends SerializeSyncInternalOptions {
	space?: number;
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
				head: result.head,
				tail: result.refs,
			},
			null,
			options.space,
		),
	};
}

export type ReviverFn = (value: unknown) => unknown;
export type ReviverRecord = Record<string, ReviverFn>;
export interface DeserializeOptions {
	head: JsonValue;
	revivers?: ReviverRecord;
	tail: RefRecord;
}

export function deserializeSync<T>(options: DeserializeOptions): T {
	const revivers = options.revivers ?? {};
	const refResult = new Map<RefLikeString, unknown>();

	let rootResult: unknown;

	function getTailResult(refId: RefLikeString): unknown {
		if (refResult.has(refId)) {
			return refResult.get(refId);
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tailValue = options.tail[refId]!;

		const result = deserializeValue(tailValue);
		refResult.set(refId, result);
		return result;
	}

	function deserializeValue(value: JsonValue, isRoot = false): unknown {
		if (isRefLikeString(value)) {
			if (value === "$0") {
				return rootResult;
			}
			return getTailResult(value);
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

			if (value._ === "$") {
				const tailValue = value as CustomValue;
				if (tailValue.type === "string") {
					return tailValue.value;
				}
				const reviver = revivers[tailValue.type];
				if (!reviver) {
					throw new Error(`No reviver found for reducer: ${tailValue.type}`);
				}
				return reviver(tailValue.value);
			}
			if (isRoot) {
				rootResult = result;
			}
			for (const [key, val] of Object.entries(value)) {
				result[key] = deserializeValue(val, isRoot);
			}
			return result;
		}

		throw new Error("Deserializing unknown value");
	}

	return deserializeValue(options.head, true) as T;
}

export interface ParseSyncOptions {
	revivers?: ReviverRecord;
}
export function parseSync<T>(value: string, options?: ParseSyncOptions) {
	const json = JSON.parse(value) as { head: JsonValue; tail: RefRecord };
	return deserializeSync<T>({
		...options,
		...json,
	});
}

/* eslint-enable @typescript-eslint/restrict-template-expressions */
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
