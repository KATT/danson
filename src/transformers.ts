import {
	Deserialize,
	DeserializerRecord,
	SerializeFn,
	SerializeRecord,
	TransformerPair,
} from "./sync.js";

type TransformBigInt = TransformerPair<bigint, string>;

const serializeBigInt: TransformBigInt["serialize"] = (value) => {
	if (typeof value !== "bigint") {
		return false;
	}
	return value.toString();
};
const deserializeBigInt: TransformBigInt["deserialize"] = (value) =>
	BigInt(value);

type TransformDate = TransformerPair<Date, string>;

const serializeDate: TransformDate["serialize"] = (value) => {
	if (!(value instanceof Date)) {
		return false;
	}
	return value.toJSON();
};
const deserializeDate: TransformDate["deserialize"] = (value) =>
	new Date(value);

type TransformMap = TransformerPair<
	Map<unknown, unknown>,
	[unknown, unknown][]
>;

const serializeMap: TransformMap["serialize"] = (value) => {
	if (!(value instanceof Map)) {
		return false;
	}
	return Array.from(value.entries());
};
const deserializeMap: TransformMap["deserialize"] = {
	create: () => new Map(),
	set: (map, values) => {
		for (const [key, value] of values) {
			map.set(key, value);
		}
	},
};

type TransformRegExp = TransformerPair<RegExp, [string, string]>;

const serializeRegExp: TransformRegExp["serialize"] = (value) => {
	if (!(value instanceof RegExp)) {
		return false;
	}
	return [value.source, value.flags];
};

const deserializeRegExp: TransformRegExp["deserialize"] = (value) => {
	const [source, flags] = value;
	return new RegExp(source, flags);
};

type TransformSet = TransformerPair<Set<unknown>, unknown[]>;

const serializeSet: TransformSet["serialize"] = (value) => {
	if (!(value instanceof Set)) {
		return false;
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return Array.from(value.values());
};
const deserializeSet: TransformSet["deserialize"] = {
	create: () => new Set(),
	set: (set, values) => {
		for (const value of values) {
			set.add(value);
		}
	},
};

type TransformUndef = TransformerPair<undefined, void>;

const serializeUndef: TransformUndef["serialize"] = (value) => {
	if (value !== undefined) {
		return false;
	}
	return undefined;
};
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
	undef: serializeUndef,
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
	undef: deserializeUndef,
} satisfies DeserializerRecord;
