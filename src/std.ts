import { DansonError } from "./error.js";
import {
	DeserializerRecord,
	PlaceholderTransformer,
	SerializeRecord,
	TransformerPair,
} from "./sync.js";

type TransformBigInt = TransformerPair<bigint, string>;

const serializeBigInt: TransformBigInt["serialize"] = (value) =>
	typeof value === "bigint" ? value.toString() : false;
const deserializeBigInt: TransformBigInt["deserialize"] = (value) =>
	BigInt(value);

type TransformDate = TransformerPair<Date, string>;

const serializeDate: TransformDate["serialize"] = (value) =>
	value instanceof Date ? value.toJSON() : false;
const deserializeDate: TransformDate["deserialize"] = (value) =>
	new Date(value);

type TransformMap = TransformerPair<
	Map<unknown, unknown>,
	[unknown, unknown][]
>;

const serializeMap: TransformMap["serialize"] = (value) =>
	value instanceof Map ? Array.from(value.entries()) : false;
const deserializeMap: TransformMap["deserialize"] = {
	create: () => new Map(),
	set: (map, values) => {
		for (const [key, value] of values) {
			map.set(key, value);
		}
	},
};

type TransformRegExp = TransformerPair<RegExp, [string, string]>;

const serializeRegExp: TransformRegExp["serialize"] = (value) =>
	value instanceof RegExp ? [value.source, value.flags] : false;

const deserializeRegExp: TransformRegExp["deserialize"] = (value) => {
	const [source, flags] = value;
	return new RegExp(source, flags);
};

type TransformSet = TransformerPair<Set<unknown>, unknown[]>;

const serializeSet: TransformSet["serialize"] = (value) =>
	value instanceof Set ? Array.from(value.values()) : false;
const deserializeSet: TransformSet["deserialize"] = {
	create: () => new Set(),
	set: (set, values) => {
		for (const value of values) {
			set.add(value);
		}
	},
};

const transformUndefined = {
	placeholder: "undefined",
	value: undefined,
} satisfies PlaceholderTransformer<undefined>;

type TransformURL = TransformerPair<URL, string>;

const serializeURL: TransformURL["serialize"] = (value) =>
	value instanceof URL ? value.href : false;
const deserializeURL: TransformURL["deserialize"] = (value) => new URL(value);

type TransformURLSearchParams = TransformerPair<URLSearchParams, string>;

const serializeURLSearchParams: TransformURLSearchParams["serialize"] = (
	value,
) => (value instanceof URLSearchParams ? value.toString() : false);
const deserializeURLSearchParams: TransformURLSearchParams["deserialize"] = (
	value,
) => new URLSearchParams(value);

type TransformHeaders = TransformerPair<Headers, [string, string][]>;

const serializeHeaders: TransformHeaders["serialize"] = (value) =>
	value instanceof Headers ? Array.from(value.entries()) : false;
const deserializeHeaders: TransformHeaders["deserialize"] = {
	create: () => new Headers(),
	set: (headers, entries) => {
		for (const [key, value] of entries) {
			headers.append(key, value);
		}
	},
};

type TransformTypedArray = TransformerPair<
	| BigInt64Array
	| BigUint64Array
	| Float32Array
	| Float64Array
	| Int8Array
	| Int16Array
	| Int32Array
	| Uint8Array
	| Uint8ClampedArray
	| Uint16Array
	| Uint32Array,
	[type: string, data: bigint[] | number[]]
>;

const serializeTypedArray: TransformTypedArray["serialize"] = (value) => {
	if (
		value instanceof Int8Array ||
		value instanceof Uint8Array ||
		value instanceof Uint8ClampedArray ||
		value instanceof Int16Array ||
		value instanceof Uint16Array ||
		value instanceof Int32Array ||
		value instanceof Uint32Array ||
		value instanceof Float32Array ||
		value instanceof Float64Array
	) {
		return [value.constructor.name, Array.from(value)];
	}
	if (value instanceof BigInt64Array || value instanceof BigUint64Array) {
		return [value.constructor.name, Array.from(value)];
	}
	return false;
};

const deserializeTypedArray: TransformTypedArray["deserialize"] = (value) => {
	const [type, data] = value;
	const TypedArrayConstructor = globalThis[
		type as keyof typeof globalThis
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	] as new (data: bigint[] | number[]) => any;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return new TypedArrayConstructor(data);
};

const infinity = {
	placeholder: "Infinity",
	value: Infinity,
} satisfies PlaceholderTransformer<number>;

const negativeInfinity = {
	placeholder: "-Infinity",
	value: -Infinity,
} satisfies PlaceholderTransformer<number>;

const negativeZero = {
	placeholder: "-0",
	value: -0,
} satisfies PlaceholderTransformer<number>;

const numberNaN = {
	placeholder: "NaN",
	value: NaN,
} satisfies PlaceholderTransformer<number>;

/**
 * Built-in serializers for common JS types
 */
export const serializers = {
	BigInt: serializeBigInt,
	Date: serializeDate,
	Headers: serializeHeaders,
	infinity,
	Map: serializeMap,
	NaN: numberNaN,
	negativeInfinity,
	negativeZero,
	RegExp: serializeRegExp,
	Set: serializeSet,
	TypedArray: serializeTypedArray,
	undefined: transformUndefined,
	URL: serializeURL,
	URLSearchParams: serializeURLSearchParams,
} satisfies SerializeRecord;

/**
 * Built-in deserializers for common JS types
 */
export const deserializers = {
	BigInt: deserializeBigInt,
	Date: deserializeDate,
	Headers: deserializeHeaders,
	infinity,
	Map: deserializeMap,
	NaN: numberNaN,
	negativeInfinity,
	negativeZero,
	RegExp: deserializeRegExp,
	Set: deserializeSet,
	TypedArray: deserializeTypedArray,
	undefined: transformUndefined,
	URL: deserializeURL,
	URLSearchParams: deserializeURLSearchParams,
} satisfies DeserializerRecord;
