export type JsonArray = JsonValue[] | readonly JsonValue[];

export interface JsonObject {
	[key: number | string]: JsonValue;
	[key: symbol]: never;
}

export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export interface ParseOptions {
	revivers?: Record<string, (value: unknown) => unknown>;
}
export interface SerializeOptions {
	coerceError?: (cause: unknown) => unknown;
	reducers?: Record<
		string,
		(value: unknown) => Exclude<JsonValue, boolean> | false
	>;
}

type CounterFn<T extends string> = () => number & {
	_brand: T;
};
export function counter<T extends string>(): CounterFn<T> {
	let i = 0;
	return () => {
		return ++i as number & { _brand: T };
	};
}

export function isJsonPrimitive(thing: unknown): thing is JsonPrimitive {
	const type = typeof thing;
	return type === "boolean" || type === "number" || type === "string";
}
