import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
	isPlainObject,
	JsonArray,
	JsonObject,
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

export type SerializerName = Branded<string, "serializer">;
export type SerializerFn = (value: unknown) => unknown;
export type SerializerRecord = Record<string, SerializerFn>;

export type RefIndex = ReturnType<CounterFn<"ref">>;

type Satisfies<T, U extends T> = U;

export type CustomValue = Satisfies<
	JsonObject,
	{
		_: "$"; // as it's a reserved string
		type: SerializerName;
		value: JsonValue;
	}
>;

type RefRecord = Record<RefLikeString, JsonValue>;

const reservedSerializerNames = new Set(["string"]);

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
	const serializers = options.serializers ?? {};

	for (const name of reservedSerializerNames) {
		if (name in serializers) {
			throw new Error(`${name} is a reserved serializer name`);
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

		for (const name in serializers) {
			const fn = serializers[name];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const value = fn!(thing);
			if (value === false) {
				continue;
			}

			const customValue: CustomValue = {
				_: "$",
				type: name as SerializerName,
				value: 0,
			};

			customValue.value = toJson(value, [customValue, "value"]);

			return customValue;
		}

		if (isJsonPrimitive(thing)) {
			if (isRefLikeString(thing)) {
				const value: CustomValue = {
					_: "$",
					type: "string" as SerializerName,
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
	serializers?: SerializerRecord;
}

export interface StringifyOptions extends SerializeOptions {
	space?: number | string;
}

export function stringifySync(value: unknown, options: StringifyOptions) {
	const result = serializeSync(value, options);

	return JSON.stringify(result, null, options.space);
}

export type DeserializerFn<T> = (value: unknown) => T;
export interface RecursiveDeserializerFn<T> {
	create: () => T;
	set: (obj: T, value: unknown) => void;
}

export type Deserializer<T> = DeserializerFn<T> | RecursiveDeserializerFn<T>;

export type DeserializerRecord = Record<string, Deserializer<unknown>>;
export interface DeserializeOptions extends SerializeReturn {
	cache?: Map<RefLikeString, unknown>;
	deserializers?: DeserializerRecord;
}
export function deserializeSync<T>(options: DeserializeOptions): T {
	const deserializers = options.deserializers ?? {};
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
				const deserializer = deserializers[refValue.type];
				if (!deserializer) {
					throw new Error(
						`No deserializer found for serializer: ${refValue.type}`,
					);
				}
				if (typeof deserializer === "function") {
					return deserializer(deserializeValue(refValue.value));
				}
				const result = deserializer.create();
				if (refId) {
					cache.set(refId, result);
				}
				deserializer.set(result, deserializeValue(refValue.value));
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
	deserializers?: DeserializerRecord;
}
export function parseSync<T>(value: string, options?: ParseSyncOptions) {
	const json = JSON.parse(value) as SerializeReturn;
	return deserializeSync<T>({
		...options,
		...json,
	});
}
