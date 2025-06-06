/* eslint-disable @typescript-eslint/restrict-template-expressions */

/**
 * We're making a json stringifier that can be used to serialize and deserialize data.
 */

import { StringifyOptions } from "./types.js";

const object_proto_names = Object.getOwnPropertyNames(Object.prototype)
	.sort()
	.join("\0");
type JsonArray = JsonValue[] | readonly JsonValue[];

interface JsonObject {
	[key: number | string]: JsonValue;
	[key: symbol]: never;
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonArray | JsonObject | JsonPrimitive;
export function is_plain_object(
	thing: unknown,
): thing is Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const proto = Object.getPrototypeOf(thing);

	return (
		proto === Object.prototype ||
		proto === null ||
		Object.getOwnPropertyNames(proto).sort().join("\0") === object_proto_names
	);
}
export function is_primitive(thing: unknown): thing is JsonPrimitive {
	const type = typeof thing;
	return type === "boolean" || type === "number" || type === "string";
}

export function stringifySync(value: unknown, options: StringifyOptions = {}) {
	const values = new Map<unknown, number>();
	type Chunk = { index: number } & (
		| {
				type: "array";
				value: Chunk[];
		  }
		| {
				type: "object";
				value: Record<string, Chunk>;
		  }
		| {
				type: "primitive";
				value: JsonPrimitive;
		  }
		| {
				type: "ref";
		  }
	);
	const refs = new Set<number>();

	let index = 0;

	function introspect(thing: unknown): Chunk {
		const existing = values.get(thing);
		if (existing !== undefined) {
			refs.add(existing);

			return {
				index: existing,
				type: "ref",
			};
		}

		values.set(thing, ++index);

		if (is_primitive(thing)) {
			return {
				index,
				type: "primitive",
				value: thing,
			};
		}

		if (is_plain_object(thing)) {
			return {
				index,
				type: "object",
				value: Object.fromEntries(
					Object.entries(thing).map(([key, value]) => [key, introspect(value)]),
				),
			};
		}

		if (Array.isArray(thing)) {
			return {
				index,
				type: "array",
				value: thing.map(introspect),
			};
		}

		throw new Error("unimplemented");
	}

	type Tail = [number, JsonValue][];
	let refCount = 0;

	const refMap: Record<number, number> = {};
	function getRefIdForIndex(index: number): number {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return 0;
		}
		if (refMap[index]) {
			return refMap[index];
		}
		refMap[index] = ++refCount;
		return refMap[index];
	}

	function toJson(part: Chunk, force: boolean): [JsonValue, Tail] {
		if (part.type === "ref") {
			const refId = getRefIdForIndex(part.index);
			return [`$${refId}`, []];
		}
		if (refs.has(part.index) && !force) {
			const [head, tail] = toJson(part, true);

			const refId = getRefIdForIndex(part.index);
			return [`$${refId}`, [[refId, head], ...tail]];
		}

		switch (part.type) {
			case "array": {
				const parts = part.value.map((v) => toJson(v, false));

				const head: JsonArray = parts.map(([head]) => head);
				const tail: Tail = parts.flatMap(([, tail]) => tail);

				return [head, tail];
			}
			case "object": {
				const head: JsonObject = {};
				const tail: Tail = [];
				for (const [key, value] of Object.entries(part.value)) {
					const [h, t] = toJson(value, false);

					head[key] = h;
					tail.push(...t);
				}
				return [head, tail];
			}
			case "primitive": {
				return [part.value, []];
			}
		}
	}

	const chunk = introspect(value);
	const [head, tail] = toJson(chunk, true);
	return {
		chunk,
		head,
		tail,
	};
}

/* eslint-enable @typescript-eslint/restrict-template-expressions */
