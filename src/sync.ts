/* eslint-disable @typescript-eslint/restrict-template-expressions */

/**
 * We're making a json stringifier that can be used to serialize and deserialize data.
 */

import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
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
type ReducerName = Branded<string, "reducer">;

type RefId = ReturnType<CounterFn<"ref">>;

type TailValue =
	| {
			reducerName: ReducerName;
			type: "reducer";
			value: JsonValue;
	  }
	| {
			type: "ref";
			value: JsonValue;
	  };
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

	function introspect(thing: unknown): AST {
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

	const tail: TailRecord = {};
	function toJson(chunk: AST, force: boolean): JsonValue {
		if (chunk.type === "ref") {
			const refId = getRefIdForIndex(chunk.index);
			return `$${refId}`;
		}
		if (knownDuplicates.has(chunk.index) && !force) {
			const head = toJson(chunk, true);

			const refId = getRefIdForIndex(chunk.index);

			tail[refId] = {
				type: "ref",
				value: head,
			};
			return `$${refId}`;
		}

		switch (chunk.type) {
			case "array": {
				return chunk.value.map((v) => toJson(v, false));
			}
			case "custom": {
				const refId = getRefIdForIndex(chunk.index);
				const tailValue = toJson(chunk.value, false);

				tail[refId] = {
					reducerName: chunk.name,
					type: "reducer",
					value: tailValue,
				};

				return `$${refId}`;
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
				const refId = getRefIdForIndex(chunk.index);
				const head = chunk.value;
				tail[refId] = {
					reducerName: "_$" as ReducerName,
					type: "reducer",
					value: head,
				};
				return head;
			}
		}
	}

	const ast = introspect(value);

	const head = toJson(ast, true);
	return {
		ast,
		head,
		tail,
	};
}

export interface DeserializeOptions {
	head: JsonValue;
	revivers?: Record<string, (value: unknown) => unknown>;
	tail: TailRecord;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function deserializeSync<T>(options: DeserializeOptions): T {
	const revivers = options.revivers ?? {};
	const refResult = new Map<RefId, unknown>();

	let rootResult: unknown;

	function getTailResult(refId: RefId): unknown {
		if (refResult.has(refId)) {
			return refResult.get(refId);
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const tailValue = options.tail[refId]!;

		switch (tailValue.type) {
			case "reducer": {
				const reviver = revivers[tailValue.reducerName];
				if (!reviver) {
					throw new Error(
						`No reviver found for reducer: ${tailValue.reducerName}`,
					);
				}
				const result = reviver(tailValue.value);
				refResult.set(refId, result);
				return result;
			}
			case "ref": {
				const result = deserializeValue(tailValue.value);
				refResult.set(refId, result);

				return result;
			}
		}
	}

	function deserializeValue(value: JsonValue, isRoot = false): unknown {
		if (isRefLikeString(value)) {
			const refId = Number(value.slice(1)) as RefId;
			// Special handling for self-referencing objects at top level
			if (refId === 0) {
				return rootResult;
			}
			return getTailResult(refId);
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
