import { ReducerFn, ReducerRecord, Reviver, ReviverRecord } from "./sync.js";

export const transformers = {
	BigInt: {
		reducer: (value) => {
			if (typeof value !== "bigint") {
				return false;
			}
			return value.toString();
		},
		reviver: (value) => BigInt(value as string),
	},
	Date: {
		reducer: (value) => {
			if (!(value instanceof Date)) {
				return false;
			}
			return value.toJSON();
		},
		reviver: (value) => new Date(value as string),
	},
	Map: {
		reducer: (value) => {
			if (!(value instanceof Map)) {
				return false;
			}
			return Array.from(value.entries());
		},
		reviver: {
			create: () => new Map(),
			set: (map, values) => {
				for (const [key, value] of values as [unknown, unknown][]) {
					(map as Map<unknown, unknown>).set(key, value);
				}
			},
		},
	},
	Set: {
		reducer: (value) => {
			if (!(value instanceof Set)) {
				return false;
			}

			return Array.from(value.values());
		},
		reviver: {
			create: () => new Set(),
			set: (set, values) => {
				for (const value of values as unknown[]) {
					(set as Set<unknown>).add(value);
				}
			},
		},
	},
	undef: {
		reducer: (value) => {
			if (value === undefined) {
				return undefined;
			}
			return false;
		},
		reviver: () => undefined,
	},
} satisfies Record<
	string,
	{
		reducer: ReducerFn;
		reviver: Reviver<unknown>;
	}
>;

export const reducers: ReducerRecord = {
	...Object.fromEntries(
		Object.entries(transformers).map(([key, { reducer }]) => [key, reducer]),
	),
};

export const revivers: ReviverRecord = {
	...Object.fromEntries(
		Object.entries(transformers).map(([key, { reviver }]) => [key, reviver]),
	),
};
