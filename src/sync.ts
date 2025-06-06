/* eslint-disable @typescript-eslint/restrict-template-expressions */

/**
 * We're making a json stringifier that can be used to serialize and deserialize data.
 */

import { StringifyOptions } from "./types.js";

type Primitive = bigint | boolean | number | string;

type StringType = [false, string] | [true, string];

const object_proto_names = Object.getOwnPropertyNames(Object.prototype)
	.sort()
	.join("\0");
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

export function is_primitive(
	thing: unknown,
): thing is bigint | boolean | number | string {
	return Object(thing) !== thing;
}

export function stringify_string(str: string) {
	let result = "";
	let last_pos = 0;
	const len = str.length;

	for (let i = 0; i < len; i += 1) {
		const char = str[i];
		const replacement = get_escaped_char(char);
		if (replacement) {
			result += str.slice(last_pos, i) + replacement;
			last_pos = i + 1;
		}
	}

	return `"${last_pos === 0 ? str : result + str.slice(last_pos)}"`;
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
				value: Primitive;
		  }
		| {
				type: "ref";
		  }
	);
	const refs = new Set<number>();

	let index = 0;

	function introspect(thing: unknown): Chunk {
		index++;
		const existing = values.get(thing);
		if (existing) {
			refs.add(existing);

			return {
				index: existing,
				type: "ref",
			};
		}

		values.set(thing, index);

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

	type Tail = [number, string][];
	function print(part: Chunk, force?: boolean): [string, Tail] {
		if (refs.has(part.index) && !force) {
			const [head, tail] = print(part, true);
			return [
				`\n${part.index}\n`,
				[
					//
					[part.index, head],
					...tail,
				],
			];
		}
		let headAggregate = "";
		const tailAggregate: Tail = [];

		switch (part.type) {
			case "array": {
				const parts = part.value.map((v) => print(v));

				headAggregate += `[${parts.map(([head]) => head).join(",")}]`;

				for (const [, t] of parts) {
					tailAggregate.push(...t);
				}
				break;
			}
			case "object": {
				headAggregate += "{";
				let isFirst = true;
				for (const [key, value] of Object.entries(part.value)) {
					const [h, t] = print(value);
					if (!isFirst) {
						headAggregate += ",";
					}
					headAggregate += `${stringify_string(key)}:${h}`;
					isFirst = false;
					tailAggregate.push(...t);
				}
				headAggregate += "}";
				break;
			}
			case "primitive":
				headAggregate += stringify_primitive(part.value);
				break;
			case "ref":
				headAggregate += `\n${part.index}\n`;
				break;
		}

		return [headAggregate, tailAggregate];
	}

	const chunk = introspect(value);
	const [head, tail] = print(chunk, true);
	return [
		head,
		{
			chunk,
			head,
			tail,
		},
	] as const;
}

function get_escaped_char(char: string) {
	switch (char) {
		case "\n":
			return "\\n";
		case "\r":
			return "\\r";
		case "\t":
			return "\\t";
		case "\f":
			return "\\f";
		case "\u2028":
			return "\\u2028";
		case "\u2029":
			return "\\u2029";
		case "\b":
			return "\\b";
		case '"':
			return '\\"';
		case "<":
			return "\\u003C";
		case "\\":
			return "\\\\";
		default:
			return char < " "
				? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
				: "";
	}
}

function stringify_primitive(thing: unknown): string {
	const type = typeof thing;
	if (type === "string") {
		return stringify_string(thing as string);
	}
	if (thing instanceof String) {
		return stringify_string(thing.toString());
	}
	if (thing === void 0) {
		return "undefined";
	}
	if (thing === 0 && 1 / thing < 0) {
		return "0";
	}
	if (type === "bigint") {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		return `["BigInt","${thing}"]`;
	}

	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return String(thing);
}
