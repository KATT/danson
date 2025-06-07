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
