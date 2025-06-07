export type Branded<T, Brand extends string> = T & { _brand: Brand };

export type CounterFn<T extends string> = () => Branded<number, `counter-${T}`>;

export type JsonArray = JsonValue[] | readonly JsonValue[];
export interface JsonObject {
	[key: number | string]: JsonValue;
	[key: symbol]: never;
}
export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export function counter<T extends string>(): CounterFn<T> {
	let i = 0;
	return () => {
		return ++i as Branded<number, `counter-${T}`>;
	};
}
export function isJsonPrimitive(thing: unknown): thing is JsonPrimitive {
	const type = typeof thing;
	return type === "boolean" || type === "number" || type === "string";
}

const objectProtoNames = Object.getOwnPropertyNames(Object.prototype)
	.sort()
	.join("\0");
export function isPlainObject(
	thing: unknown,
): thing is Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const proto = Object.getPrototypeOf(thing);

	return (
		proto === Object.prototype ||
		proto === null ||
		Object.getOwnPropertyNames(proto).sort().join("\0") === objectProtoNames
	);
}
