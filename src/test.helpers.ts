import { ReducerFn, ReducerRecord, ReviverFn, ReviverRecord } from "./sync.js";

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
		reviver: (value) => new Map(value as [unknown, unknown][]),
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
		reviver: ReviverFn;
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
