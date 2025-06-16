import {
	Deserialize,
	DeserializerRecord,
	SerializeFn,
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

/**
 * Built-in serializers for common JS types
 */
export const serializers = {
	BigInt: serializeBigInt,
	Date: serializeDate,
	Map: serializeMap,
	RegExp: serializeRegExp,
	Set: serializeSet,
	undefined: serializeUndef,
} satisfies SerializeRecord;

/**
 * Built-in deserializers for common JS types
 */
export const deserializers = {
	BigInt: deserializeBigInt,
	Date: deserializeDate,
	Map: deserializeMap,
	RegExp: deserializeRegExp,
	Set: deserializeSet,
	undefined: deserializeUndef,
} satisfies DeserializerRecord;
