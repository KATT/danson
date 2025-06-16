import { describe, expect, it } from "vitest";

import { deserializers, serializers } from "./std.js";
import { parseSync, stringifySync } from "./sync.js";

function serialize(value: unknown) {
	return stringifySync(value, {
		serializers,
	});
}

function deserialize<T>(value: string) {
	return parseSync<T>(value, {
		deserializers,
	});
}

describe("BigInt", () => {
	it("BigInt", () => {
		const value = BigInt(123);
		const serialized = serialize(value);
		const deserialized = deserialize<bigint>(serialized);
		expect(deserialized).toBe(value);
	});
});

describe("Date", () => {
	it("Date", () => {
		const value = new Date("2024-01-01T00:00:00.000Z");
		const serialized = serialize(value);
		const deserialized = deserialize<Date>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("Map", () => {
	it("Map", () => {
		const value = new Map([
			["a", 1],
			["b", 2],
		]);
		const serialized = serialize(value);
		const deserialized = deserialize<Map<string, number>>(serialized);
		expect(deserialized).toEqual(value);
	});

	it("self-referencing Map", () => {
		const value = new Map();
		value.set("self", value);
		value.set("a", 1);
		const serialized = serialize(value);
		const deserialized = deserialize<Map<string, unknown>>(serialized);

		expect(deserialized).toEqual(value);
	});
});

describe("RegExp", () => {
	it("RegExp", () => {
		const value = /test/i;
		const serialized = serialize(value);
		const deserialized = deserialize<RegExp>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("Set", () => {
	it("Set", () => {
		const value = new Set([1, 2, 3]);
		const serialized = serialize(value);
		const deserialized = deserialize<Set<number>>(serialized);
		expect(deserialized).toEqual(value);
	});

	it("self-referencing Set", () => {
		const value = new Set();
		value.add(value);
		value.add(1);
		const serialized = serialize(value);
		const deserialized = deserialize<Set<unknown>>(serialized);

		expect(deserialized).toEqual(value);
	});
});

describe("URL", () => {
	it("URL", () => {
		const value = new URL("https://example.com");
		const serialized = serialize(value);
		const deserialized = deserialize<URL>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("URLSearchParams", () => {
	it("URLSearchParams", () => {
		const value = new URLSearchParams("a=1&b=2");
		const serialized = serialize(value);
		const deserialized = deserialize<URLSearchParams>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("Headers", () => {
	it("Headers", () => {
		const value = new Headers();
		value.append("a", "1");
		value.append("b", "2");
		const serialized = serialize(value);
		const deserialized = deserialize<Headers>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("TypedArray", () => {
	it("Int8Array", () => {
		const value = new Int8Array([1, 2, 3]);
		const serialized = serialize(value);
		const deserialized = deserialize<Int8Array>(serialized);
		expect(deserialized).toEqual(value);
	});

	it("BigInt64Array", () => {
		const value = new BigInt64Array([BigInt(1), BigInt(2), BigInt(3)]);
		const serialized = serialize(value);
		const deserialized = deserialize<BigInt64Array>(serialized);
		expect(deserialized).toEqual(value);
	});
});

describe("undefined", () => {
	it("undefined", () => {
		const value = undefined;
		const serialized = serialize(value);
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
		const deserialized = deserialize<undefined>(serialized);
		expect(deserialized).toBe(value);
	});
});

describe("number", () => {
	it("Infinity", () => {
		const value = Infinity;
		const serialized = serialize(value);
		const deserialized = deserialize<number>(serialized);
		expect(deserialized).toBe(value);
	});

	it("-Infinity", () => {
		const value = -Infinity;
		const serialized = serialize(value);
		const deserialized = deserialize<number>(serialized);
		expect(deserialized).toBe(value);
	});

	it("-0", () => {
		const value = -0;
		const serialized = serialize(value);
		const deserialized = deserialize<number>(serialized);
		expect(deserialized).toBe(value);
		expect(Object.is(deserialized, -0)).toBe(true);
	});
});
