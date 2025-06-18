/**
 * Virtual property to store the original type of a serialized value.
 * @internal
 */
export const TYPE_SYMBOL = Symbol();

/**
 * Symbol to store the internal options of a serialized value.
 * @internal
 */
export const INTERNAL_OPTIONS_SYMBOL = Symbol();

export type Branded<T, Brand extends string> = T & { _brand: Brand };

/**
 * Type to mark a value as serialized.
 *
 * Returns the original type with a virtual property to store the original type.
 */
export type Serialized<T, OriginalType> = T & {
	/**
	 * Virtual property to store the original type of a serialized value.
	 * @internal
	 */
	[TYPE_SYMBOL]: OriginalType;
};

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

export function isJsonPrimitive(value: unknown): value is JsonPrimitive {
	const type = typeof value;
	return (
		type === "boolean" ||
		type === "number" ||
		type === "string" ||
		value === null
	);
}

function isObject(o: unknown): o is Record<string, unknown> {
	return Object.prototype.toString.call(o) === "[object Object]";
}

export function isPlainObject(o: unknown): o is Record<string, unknown> {
	if (!isObject(o)) {
		return false;
	}

	// If has modified constructor
	const ctor = o.constructor;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (ctor === undefined) {
		return true;
	}

	// If has modified prototype
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const prot = ctor.prototype;
	if (!isObject(prot)) {
		return false;
	}

	// If constructor does not have an Object-specific method
	if (!Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf")) {
		return false;
	}

	// Most likely a plain Object
	return true;
}
