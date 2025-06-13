import {
	Deserializer,
	DeserializerRecord,
	SerializerFn,
	SerializerRecord,
} from "./sync.js";

export const transformers = {
	BigInt: {
		deserializer: (value) => BigInt(value as string),
		serializer: (value) => {
			if (typeof value !== "bigint") {
				return false;
			}
			return value.toString();
		},
	},
	Date: {
		deserializer: (value) => new Date(value as string),
		serializer: (value) => {
			if (!(value instanceof Date)) {
				return false;
			}
			return value.toJSON();
		},
	},
	Map: {
		deserializer: {
			create: () => new Map(),
			set: (map, values) => {
				for (const [key, value] of values as [unknown, unknown][]) {
					(map as Map<unknown, unknown>).set(key, value);
				}
			},
		},
		serializer: (value) => {
			if (!(value instanceof Map)) {
				return false;
			}
			return Array.from(value.entries());
		},
	},
	RegExp: {
		deserializer: (value) => {
			const [source, flags] = value as [string, string];
			return new RegExp(source, flags);
		},
		serializer: (value) => {
			if (!(value instanceof RegExp)) {
				return false;
			}
			const { flags, source } = value;
			return [source, flags];
		},
	},
	Set: {
		deserializer: {
			create: () => new Set(),
			set: (set, values) => {
				for (const value of values as unknown[]) {
					(set as Set<unknown>).add(value);
				}
			},
		},
		serializer: (value) => {
			if (!(value instanceof Set)) {
				return false;
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return Array.from(value.values());
		},
	},
	undef: {
		deserializer: () => undefined,
		serializer: (value) => {
			if (value === undefined) {
				return 0;
			}
			return false;
		},
	},
} satisfies Record<
	string,
	{
		deserializer: Deserializer<unknown>;
		serializer: SerializerFn;
	}
>;

export const serializers: SerializerRecord = {
	...Object.fromEntries(
		Object.entries(transformers).map(([key, { serializer }]) => [
			key,
			serializer,
		]),
	),
};

export const deserializers: DeserializerRecord = {
	...Object.fromEntries(
		Object.entries(transformers).map(([key, { deserializer }]) => [
			key,
			deserializer,
		]),
	),
};
