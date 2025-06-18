import { describe, expect, expectTypeOf, test } from "vitest";

import { deserializers, serializers } from "./std.js";
import { parseSync, stringifySync } from "./sync.js";
import { Serialized } from "./utils.js";

function stringify<T>(value: T) {
	return stringifySync(value, {
		serializers,
		space: "\t",
	});
}

function parse<T>(value: Serialized<string, T>) {
	return parseSync<T>(value, {
		deserializers,
	});
}

test("BigInt", () => {
	const value = BigInt(123);
	const str = stringify(value);
	const deserialized = parse(str);
	expectTypeOf(deserialized).toEqualTypeOf<typeof value>();
	expect(deserialized).toBe(value);
});

test("Date", () => {
	const value = new Date("2024-01-01T00:00:00.000Z");
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toEqual(value);
});

describe("Map", () => {
	test("basic", () => {
		const value = new Map([
			["a", 1],
			["b", 2],
		]);
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toEqual(value);
	});

	test("self-referencing", () => {
		const value = new Map();
		value.set("self", value);
		value.set("a", 1);
		const str = stringify(value);
		const deserialized = parse(str);

		expect(deserialized).toEqual(value);
	});
});

test("RegExp", () => {
	const value = /test/i;
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toEqual(value);
});

describe("Set", () => {
	test("basic", () => {
		const value = new Set([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toEqual(value);
	});

	test("self-referencing", () => {
		const value = new Set();
		value.add(value);
		value.add(1);
		const str = stringify(value);
		const deserialized = parse(str);

		expect(deserialized).toEqual(value);
	});
});

test("URL", () => {
	const value = new URL(
		"https://user:pass@example.com:8080/path/to/page?query=value&other=123#section",
	);
	const str = stringify(value);
	const deserialized = parse(str);

	expect(deserialized).toEqual(value);
});

test("URLSearchParams", () => {
	const value = new URLSearchParams("a=1&b=2");
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toEqual(value);
});

test("Headers", () => {
	const value = new Headers();
	value.append("a", "1");
	value.append("b", "2");
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toEqual(value);
});

describe("TypedArray", () => {
	test("Int8Array", () => {
		const value = new Int8Array([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toEqual(value);
	});

	test("BigInt64Array", () => {
		const value = new BigInt64Array([BigInt(1), BigInt(2), BigInt(3)]);
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toEqual(value);
	});
});

test("undefined", () => {
	const value = {
		foo: undefined,
	};
	const str = stringify(value);

	const deserialized = parse(str);

	expect(deserialized).toHaveProperty("foo", undefined);
	expect(deserialized).toEqual(value);

	expect(str).toMatchInlineSnapshot(`
		"{
			"json": {
				"foo": "$undefined"
			}
		}"
	`);
});

test("Infinity", () => {
	const value = Infinity;
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toBe(value);
});

test("-Infinity", () => {
	const value = -Infinity;
	const str = stringify(value);
	const deserialized = parse(str);
	expect(deserialized).toBe(value);
});

test("-0", () => {
	{
		const value = -0;
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toBe(value);

		expect(str).toMatchInlineSnapshot(`
			"{
				"json": "$-0"
			}"
		`);
	}

	{
		const value = 0;
		const str = stringify(value);
		const deserialized = parse(str);
		expect(deserialized).toBe(value);
	}
});

// this is up for debate, but I think it's better to throw than to serialize NaN
test("NaN should throw", () => {
	const value = {
		foo: NaN,
	};
	const str = stringify(value);
	expect(() => parse(str)).toThrow();
});
