import {
	Branded,
	counter,
	CounterFn,
	isJsonPrimitive,
	isPlainObject,
	JsonArray,
	JsonObject,
	JsonValue,
	Typed,
} from "./utils.js";

export type RefLikeString<TNumber extends number = number> = `$${TNumber}`;

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
export function numberToRef<T extends number>(index: T): RefLikeString<T> {
	// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
	return `$${index}`;
}

type Index = ReturnType<CounterFn<"index">>;

export type SerializeRecordKey = Branded<string, "serializer">;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type SerializeFn<_TOriginal, TSerialized> = (
	value: unknown,
) => false | TSerialized;

export type SerializeRecord = Record<
	string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	SerializeFn<any, any>
>;

export type RefIndex = ReturnType<CounterFn<"ref">>;

type Satisfies<T, U extends T> = U;

export type CustomValue = Satisfies<
	JsonObject,
	{
		_: "$"; // as it's a reserved string
		type: SerializeRecordKey;
		value?: JsonValue;
	}
>;
function isCustomValue(value: Record<string, unknown>): value is CustomValue {
	return value._ === "$" && typeof value.type === "string";
}

type RefRecord = Record<RefLikeString, JsonValue>;

const reservedSerializerNames = new Set(["string"]);

type Path = (number | string)[];

function isSubPath(path: Path, subPath: Path): boolean {
	if (path.length < subPath.length) {
		return false;
	}
	for (let i = 0; i < subPath.length; i++) {
		if (path[i] !== subPath[i]) {
			return false;
		}
	}
	return true;
}

export function serializeSync<T>(value: T, options: SerializeOptions = {}) {
	type Location = [parent: JsonArray | JsonObject, key: number | string] | null;

	const values = new Map<unknown, [Index, Location, Path]>();
	const refs: RefRecord = {};
	const replaceMap = new Map<RefLikeString, Location>();

	const internal: SerializeInternalOptions = options.internal ?? {
		indexCounter: counter(),
		indexToRefRecord: {},
		knownDuplicates: new Set(),
		refCounter: counter(),
	};
	function shouldDedupe(value: unknown): boolean {
		if (typeof options.dedupe === "function") {
			return options.dedupe(value);
		}
		return options.dedupe ?? false;
	}
	const serializers = options.serializers ?? {};

	for (const name of reservedSerializerNames) {
		if (name in serializers) {
			throw new Error(`${name} is a reserved serializer name`);
		}
	}

	function toJson(thing: unknown, location: Location, path: Path): JsonValue {
		const existing = values.get(thing);

		if (existing) {
			const [index, location, existingPath] = existing;

			if (shouldDedupe(thing) || isSubPath(path, existingPath)) {
				const refId: RefLikeString = getOrCreateRef(index);

				replaceMap.set(refId, location);

				return refId;
			}
		}
		const index = internal.indexCounter();
		values.set(thing, [index, location, path]);

		for (const name in serializers) {
			const fn = serializers[name];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment
			const value = fn!(thing);
			if (value === false) {
				continue;
			}

			const customValue: CustomValue = {
				_: "$",
				type: name as SerializeRecordKey,
			};

			if (value !== undefined) {
				customValue.value = toJson(
					value,
					[customValue, "value"],
					[...path, "value"],
				);
			}

			return customValue;
		}

		if (isJsonPrimitive(thing)) {
			if (isRefLikeString(thing)) {
				const value: CustomValue = {
					_: "$",
					type: "string" as SerializeRecordKey,
					value: thing,
				};
				return value;
			}

			return thing;
		}

		if (isPlainObject(thing)) {
			const result: Record<string, JsonValue> = {};
			for (const key in thing) {
				result[key] = toJson(thing[key], [result, key], [...path, key]);
			}
			return result;
		}

		if (Array.isArray(thing)) {
			const result: JsonValue[] = [];
			for (const [index, it] of thing.entries()) {
				result.push(toJson(it, [result, index], [...path, index]));
			}
			return result;
		}

		// eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
		throw new Error(`Do not know how to serialize ${thing}`);
	}

	const indexToRefRecord: Record<Index, RefLikeString> = {};
	function getOrCreateRef(index: Index): RefLikeString {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return numberToRef(0);
		}
		if (indexToRefRecord[index]) {
			return indexToRefRecord[index];
		}

		const refId: RefLikeString = numberToRef(internal.refCounter());
		indexToRefRecord[index] = refId;

		return refId;
	}

	const json = toJson(value, null, []);

	for (const [refId, location] of replaceMap) {
		if (!location) {
			continue;
		}

		const [parent, key] = location;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		const value = parent[key as any] as JsonValue;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		(parent as any)[key] = refId;

		refs[refId] = value;
	}

	const result: SerializeReturn = {
		json,
	};
	if (Object.keys(refs).length > 0) {
		result.refs = refs;
	}

	return result as Typed<SerializeReturn, T>;
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

	/**
	 * Dedupe values.
	 *
	 * If a value is encountered multiple times, it will be replaced with a reference to the first occurrence.
	 *
	 * If a function is provided, it will be called with the value and should return a boolean indicating whether the value should be deduped.
	 * @default false
	 */
	dedupe?: ((value: unknown) => boolean) | boolean;

	/**
	 * @private
	 */
	internal?: SerializeInternalOptions;
	serializers?: SerializeRecord;
}

export interface StringifyOptions extends SerializeOptions {
	space?: number | string;
}

export function stringifySync<T>(value: T, options: StringifyOptions = {}) {
	const result = serializeSync(value, options);

	return JSON.stringify(result, null, options.space) as Typed<string, T>;
}

export type DeserializerFn<TOriginal, TSerialized> = (
	value: TSerialized,
) => TOriginal;
export interface DeserializeRecursive<TOriginal, TSerialized> {
	create: () => TOriginal;
	set: (obj: TOriginal, value: TSerialized) => void;
}

export type Deserialize<TOriginal, TSerialized> =
	| DeserializeRecursive<TOriginal, TSerialized>
	| DeserializerFn<TOriginal, TSerialized>;

export type DeserializerRecord = Record<
	string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Deserialize<any, any>
>;
export interface DeserializeOptions extends SerializeReturn {
	cache?: Map<RefLikeString, unknown>;
	deserializers?: DeserializerRecord;
}
export type TypedDeserializeOptions<T> = Typed<DeserializeOptions, T>;
export function deserializeSync<T>(
	options: DeserializeOptions | TypedDeserializeOptions<T>,
): T {
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
			if (isCustomValue(value)) {
				const refType = value.type;
				const refValue = value.value;
				if (refType === "string") {
					return refValue;
				}
				const deserializer = deserializers[refType];
				if (!deserializer) {
					throw new Error(`No deserializer found for serializer: ${refType}`);
				}
				if (typeof deserializer === "function") {
					return deserializer(
						refValue === undefined ? undefined : deserializeValue(refValue),
					);
				}
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const result = deserializer.create();
				if (refId) {
					cache.set(refId, result);
				}
				deserializer.set(
					result,
					refValue === undefined ? undefined : deserializeValue(refValue),
				);
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

	const result = deserializeValue(options.json, numberToRef(0)) as T;

	return result;
}

export interface ParseSyncOptions {
	deserializers?: DeserializerRecord;
}
export function parseSync<T>(
	value: Typed<string, T>,
	options?: ParseSyncOptions,
): T;
export function parseSync<T>(value: string, options?: ParseSyncOptions) {
	const json = JSON.parse(value) as SerializeReturn;
	return deserializeSync<T>({
		...options,
		...json,
	} as TypedDeserializeOptions<T>);
}

export interface TransformerPair<TOriginal, TSerialized> {
	deserialize: Deserialize<TOriginal, TSerialized>;
	serialize: SerializeFn<TOriginal, TSerialized>;
}
