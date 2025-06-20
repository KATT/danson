import { DansonError } from "./error.js";
import {
	Branded,
	counter,
	CounterFn,
	INTERNAL_OPTIONS_SYMBOL,
	isJsonPrimitive,
	isPlainObject,
	JsonArray,
	JsonObject,
	JsonValue,
	Serialized,
} from "./utils.js";

export type PlaceholderValue = Branded<string, "placeholder">;

function isPlaceholderValue(
	value: string,
	opts: Delimiters,
): value is PlaceholderValue {
	return (
		value.length >= opts.prefix.length + opts.suffix.length &&
		value.startsWith(opts.prefix) &&
		value.endsWith(opts.suffix)
	);
}

export function placeholderOf(
	value: number | string,
	opts: Delimiters,
): PlaceholderValue {
	// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
	return (opts.prefix + value + opts.suffix) as PlaceholderValue;
}

export interface Delimiters {
	/**
	 * The prefix to use for placeholder values.
	 */
	prefix: string;

	/**
	 * The suffix to use for placeholder values.
	 */
	suffix: string;
}

type Index = ReturnType<CounterFn<"index">>;

export type SerializeRecordKey = Branded<string, "serializer">;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type SerializeFn<_TOriginal, TSerialized> = (
	value: unknown,
) => false | TSerialized;

/**
 * For exact types, you can use the `PlaceholderTransformer` interface to create a custom serializer.
 */
export interface PlaceholderTransformer<
	TOriginal,
	TSerialized extends string = string,
> {
	placeholder: TSerialized;
	value: TOriginal;
}

export type SerializeRecord = Record<
	string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	PlaceholderTransformer<any> | SerializeFn<any, any>
>;

export type RefIndex = ReturnType<CounterFn<"ref">>;

type Satisfies<T, U extends T> = U;

export type CustomValue = Satisfies<
	JsonObject,
	{
		_: PlaceholderValue;
		type: SerializeRecordKey;
		value?: JsonValue;
	}
>;
function isCustomValue(
	value: Record<string, unknown>,
	opts: Delimiters,
): value is CustomValue {
	return value._ === opts.prefix + opts.suffix;
}

type RefRecord = Record<PlaceholderValue, JsonValue>;

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

export const defaultDelimiters = {
	prefix: "$",
	suffix: "",
} as const satisfies Delimiters;

/**
 * Serializes a value into an intermediate format.
 * This is a low-level function used internally by `stringifySync` but can be useful for custom serialization pipelines.
 * @param value The value to serialize
 * @param options Serialization options
 * @returns An object containing the serialized JSON and any references
 */
export function serializeSync<T>(value: T, options: SerializeOptions = {}) {
	if (value === undefined) {
		return {} as Serialized<SerializeReturn, T>;
	}
	type Location = [parent: JsonArray | JsonObject, key: number | string] | null;

	const values = new Map<unknown, [Index, Location, Path]>();
	const refs: RefRecord = {};
	const replaceMap = new Map<PlaceholderValue, Location>();

	const delimiters: Delimiters = options.delimiters ?? defaultDelimiters;

	const internal: SerializeInternalOptions = options[
		INTERNAL_OPTIONS_SYMBOL
	] ?? {
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

	const placeholders = new Map<unknown, PlaceholderTransformer<unknown>>();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const serializers: Record<string, SerializeFn<any, any>> = {};

	for (const [key, value] of Object.entries(options.serializers ?? {})) {
		if (typeof value === "function") {
			serializers[key] = value;
		} else {
			placeholders.set(value.value, value);
		}
	}

	// const serializers = options.serializers ?? {};

	for (const name of reservedSerializerNames) {
		if (name in serializers) {
			throw new DansonError(`${name} is a reserved serializer name`);
		}
	}

	function toJson(thing: unknown, location: Location, path: Path): JsonValue {
		const existing = values.get(thing);

		if (existing) {
			const [index, location, existingPath] = existing;

			if (shouldDedupe(thing) || isSubPath(path, existingPath)) {
				const refId = getOrCreateRef(index);

				replaceMap.set(refId, location);

				return refId;
			}
		}
		const index = internal.indexCounter();
		values.set(thing, [index, location, path]);

		const transformer = placeholders.get(thing);
		if (transformer && Object.is(transformer.value, thing)) {
			return delimiters.prefix + transformer.placeholder + delimiters.suffix;
		}

		for (const name in serializers) {
			const fn = serializers[name];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-assignment
			const value = fn!(thing);
			if (value === false) {
				continue;
			}

			const customValue: CustomValue = {
				_: (delimiters.prefix + delimiters.suffix) as PlaceholderValue,
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
			if (typeof thing === "string" && isPlaceholderValue(thing, delimiters)) {
				const value: CustomValue = {
					_: (delimiters.prefix + delimiters.suffix) as PlaceholderValue,
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
		throw new DansonError(`Do not know how to serialize ${thing}`);
	}

	const indexToRefRecord: Record<Index, PlaceholderValue> = {};
	function getOrCreateRef(index: Index): PlaceholderValue {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return placeholderOf(0, delimiters);
		}
		if (indexToRefRecord[index]) {
			return indexToRefRecord[index];
		}

		const refId = placeholderOf(internal.refCounter(), delimiters);
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

	return result as Serialized<SerializeReturn, T>;
}

export interface SerializeReturn {
	json?: JsonValue;
	refs?: RefRecord;
}

export interface SerializeInternalOptions {
	indexCounter: CounterFn<"index">;
	indexToRefRecord: Record<Index, RefIndex>;
	knownDuplicates: Set<[Index, Location]>;
	refCounter: CounterFn<"ref">;
}

export interface SerializeOptions {
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
	 * Internal options that we use when doing async serialization.
	 * @private
	 */
	delimiters?: Delimiters;
	[INTERNAL_OPTIONS_SYMBOL]?: SerializeInternalOptions;
	serializers?: SerializeRecord;
}

export interface StringifyOptions extends SerializeOptions {
	/**
	 * The number of spaces to use for indentation.
	 * @default undefined
	 */
	space?: number | string;
}

/**
 * Serializes a value into a JSON string stream.
 * @returns An async iterable that yields JSON string chunks
 */
export function stringifySync<T>(value: T, options: StringifyOptions = {}) {
	const result = serializeSync(value, options);

	return JSON.stringify(result, null, options.space) as Serialized<string, T>;
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
	Deserialize<any, any> | PlaceholderTransformer<any>
>;

export interface DeserializeInternalOptions {
	cache: Map<PlaceholderValue, unknown>;
}
export interface DeserializeOptions {
	deserializers?: DeserializerRecord;

	/**
	 * Internal options that we use when doing async deserialization.
	 * @private
	 */
	delimiters?: Delimiters;
	internal?: DeserializeInternalOptions;
}
export type TypedDeserializeOptions<T> = Serialized<DeserializeOptions, T>;

/**
 * Deserializes from an intermediate format.
 * This is a low-level function used internally by `parseSync` but can be useful for custom deserialization pipelines.
 * @param obj The serialized object to deserialize
 * @param options Deserialization options
 * @returns The deserialized value
 */
export function deserializeSync<T>(
	obj: Serialized<SerializeReturn, T> | SerializeReturn,
	options: DeserializeOptions = {},
): T {
	if (obj.json === undefined) {
		return undefined as T;
	}
	const refs = obj.refs ?? {};
	const deserializers: Record<string, Deserialize<unknown, unknown>> = {};
	const placeholderTransformers = new Map<string, unknown>();
	const delimiters: Delimiters = options.delimiters ?? defaultDelimiters;
	for (const [key, value] of Object.entries(options.deserializers ?? {})) {
		if (typeof value === "function" || "create" in value) {
			deserializers[key] = value;
		} else {
			placeholderTransformers.set(
				delimiters.prefix + value.placeholder + delimiters.suffix,
				value.value,
			);
		}
	}
	const cache = options.internal?.cache ?? new Map<PlaceholderValue, unknown>();

	function getRefResult(refId: PlaceholderValue): unknown {
		if (cache.has(refId)) {
			return cache.get(refId);
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const refValue = refs[refId]!;

		const result = deserializeValue(refValue, refId);
		cache.set(refId, result);

		return result;
	}

	const rootRef = placeholderOf(0, delimiters);

	function deserializeValue(
		value: JsonValue,
		refId?: PlaceholderValue,
	): unknown {
		if (typeof value === "string") {
			if (placeholderTransformers.has(value)) {
				return placeholderTransformers.get(value);
			}
			if (value in refs || value === rootRef) {
				return getRefResult(value as PlaceholderValue);
			}
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
			if (isCustomValue(value, delimiters)) {
				const refType = value.type;
				const refValue = value.value;
				if (refType === "string") {
					return refValue;
				}
				const deserializer = deserializers[refType];
				if (!deserializer) {
					throw new DansonError(
						`No deserializer found for serializer: ${refType}`,
					);
				}
				if (typeof deserializer === "function") {
					return deserializer(
						refValue === undefined ? undefined : deserializeValue(refValue),
					);
				}

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

		throw new DansonError("Deserializing unknown value");
	}

	const result = deserializeValue(obj.json, placeholderOf(0, delimiters)) as T;

	return result;
}

/**
 * Deserializes a JSON string or stream into a value.
 * @param value The JSON string or stream to deserialize
 * @param options Deserialization options
 * @returns A promise that resolves to the deserialized value
 */
export function parseSync<T>(
	value: Serialized<string, T> | string,
	options: DeserializeOptions = {},
): T {
	const json = JSON.parse(value) as Serialized<SerializeReturn, T>;
	return deserializeSync<T>(json, options);
}

export interface TransformerPair<TOriginal, TSerialized> {
	deserialize: Deserialize<TOriginal, TSerialized>;
	serialize: SerializeFn<TOriginal, TSerialized>;
}
