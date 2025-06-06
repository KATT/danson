/* eslint-disable @typescript-eslint/restrict-template-expressions */

/**
 * We're making a json stringifier that can be used to serialize and deserialize data.
 */

import { counter, isJsonPrimitive, SerializeOptions } from "./utils.js";

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

export function serializeSync(value: unknown, options: SerializeOptions = {}) {
	const values = new Map<unknown, Index>();

	const incrementIndex = counter<"index">();
	type Index = ReturnType<typeof incrementIndex>;
	type Chunk = { index: Index } & (
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
	const knownDuplicates = new Set<Index>();

	function introspect(thing: unknown): Chunk {
		const existing = values.get(thing);
		if (existing !== undefined) {
			knownDuplicates.add(existing);

			return {
				index: existing,
				type: "ref",
			};
		}
		const index = incrementIndex();
		values.set(thing, index);

		if (isJsonPrimitive(thing)) {
			return {
				index,
				type: "primitive",
				value: thing,
			};
		}

		if (isPlainObject(thing)) {
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

	const refCounter = counter<"ref">();
	type RefId = ReturnType<typeof refCounter>;

	type Tail = [RefId, JsonValue][];

	const refToIndexRecord: Record<Index, RefId> = {};
	function getRefIdForIndex(index: Index): RefId {
		if (index === 1) {
			// special handling for self-referencing objects at top level
			return 0 as RefId;
		}
		if (refToIndexRecord[index]) {
			return refToIndexRecord[index];
		}
		refToIndexRecord[index] = refCounter();
		return refToIndexRecord[index];
	}

	function toJson(part: Chunk, force: boolean): [JsonValue, Tail] {
		if (part.type === "ref") {
			const refId = getRefIdForIndex(part.index);
			return [`$${refId}`, []];
		}
		if (knownDuplicates.has(part.index) && !force) {
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

function isPlainObject(thing: unknown): thing is Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const proto = Object.getPrototypeOf(thing);

	return (
		proto === Object.prototype ||
		proto === null ||
		Object.getOwnPropertyNames(proto).sort().join("\0") === object_proto_names
	);
}

/* eslint-enable @typescript-eslint/restrict-template-expressions */
