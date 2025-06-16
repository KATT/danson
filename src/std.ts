import {
	DeserializerRecord,
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

type TransformUndef = TransformerPair<undefined, undefined>;

const serializeUndef: TransformUndef["serialize"] = (value) =>
	value === undefined ? value : false;
const deserializeUndef: TransformUndef["deserialize"] = () => undefined;

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

type TransformFormData = TransformerPair<
	FormData,
	[string, string | { name: string; size: number; type: string }][]
>;

const serializeFormData: TransformFormData["serialize"] = (value) =>
	value instanceof FormData
		? Array.from(value.entries()).map(([key, val]) => [
				key,
				val instanceof File
					? { name: val.name, size: val.size, type: val.type }
					: val.toString(),
			])
		: false;
const deserializeFormData: TransformFormData["deserialize"] = {
	create: () => new FormData(),
	set: (formData, entries) => {
		for (const [key, value] of entries) {
			if (typeof value === "string") {
				formData.append(key, value);
			} else {
				formData.append(key, new File([], value.name, { type: value.type }));
			}
		}
	},
};

type TransformBlob = TransformerPair<Blob, { size: number; type: string }>;

const serializeBlob: TransformBlob["serialize"] = (value) =>
	value instanceof Blob ? { size: value.size, type: value.type } : false;
const deserializeBlob: TransformBlob["deserialize"] = (value) =>
	new Blob([], { type: value.type });

type TransformFile = TransformerPair<
	File,
	{ name: string; size: number; type: string }
>;

const serializeFile: TransformFile["serialize"] = (value) =>
	value instanceof File
		? { name: value.name, size: value.size, type: value.type }
		: false;
const deserializeFile: TransformFile["deserialize"] = (value) =>
	new File([], value.name, { type: value.type });

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
	{ data: bigint[] | number[]; type: string }
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
		return {
			data: Array.from(value),
			type: value.constructor.name,
		};
	}
	if (value instanceof BigInt64Array || value instanceof BigUint64Array) {
		return {
			data: Array.from(value),
			type: value.constructor.name,
		};
	}
	return false;
};

const deserializeTypedArray: TransformTypedArray["deserialize"] = (value) => {
	const TypedArrayConstructor = globalThis[
		value.type as keyof typeof globalThis
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	] as new (data: bigint[] | number[]) => any;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return new TypedArrayConstructor(value.data);
};

/* eslint-disable perfectionist/sort-objects */

/**
 * Built-in serializers for common JS types
 */
export const serializers = {
	BigInt: serializeBigInt,
	File: serializeFile, // <-- needs to be before Blob as it's a subclass of Blob
	Blob: serializeBlob,
	Date: serializeDate,
	FormData: serializeFormData,
	Headers: serializeHeaders,
	Map: serializeMap,
	RegExp: serializeRegExp,
	Set: serializeSet,
	TypedArray: serializeTypedArray,
	undefined: serializeUndef,
	URL: serializeURL,
	URLSearchParams: serializeURLSearchParams,
} satisfies SerializeRecord;

/* eslint-enable perfectionist/sort-objects */

/**
 * Built-in deserializers for common JS types
 */
export const deserializers = {
	BigInt: deserializeBigInt,
	Blob: deserializeBlob,
	Date: deserializeDate,
	File: deserializeFile,
	FormData: deserializeFormData,
	Headers: deserializeHeaders,
	Map: deserializeMap,
	RegExp: deserializeRegExp,
	Set: deserializeSet,
	TypedArray: deserializeTypedArray,
	undefined: deserializeUndef,
	URL: deserializeURL,
	URLSearchParams: deserializeURLSearchParams,
} satisfies DeserializerRecord;
