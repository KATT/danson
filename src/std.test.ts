import { describe, expect, test } from "vitest";

import { deserializers, serializers } from "./std.js";
import { parseSync, stringifySync } from "./sync.js";

function stringify(value: unknown) {
	return stringifySync(value, {
		serializers,
	});
}

function parse<T>(value: string) {
	return parseSync<T>(value, {
		deserializers,
	});
}

test("BigInt", () => {
	const value = BigInt(123);
	const str = stringify(value);
	const deserialized = parse<bigint>(str);
	expect(deserialized).toBe(value);
});

test("Date", () => {
	const value = new Date("2024-01-01T00:00:00.000Z");
	const str = stringify(value);
	const deserialized = parse<Date>(str);
	expect(deserialized).toEqual(value);
});

describe("Map", () => {
	test("basic", () => {
		const value = new Map([
			["a", 1],
			["b", 2],
		]);
		const str = stringify(value);
		const deserialized = parse<Map<string, number>>(str);
		expect(deserialized).toEqual(value);
	});

	test("self-referencing", () => {
		const value = new Map();
		value.set("self", value);
		value.set("a", 1);
		const str = stringify(value);
		const deserialized = parse<Map<string, unknown>>(str);

		expect(deserialized).toEqual(value);
	});
});

test("RegExp", () => {
	const value = /test/i;
	const str = stringify(value);
	const deserialized = parse<RegExp>(str);
	expect(deserialized).toEqual(value);
});

describe("Set", () => {
	test("basic", () => {
		const value = new Set([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse<Set<number>>(str);
		expect(deserialized).toEqual(value);
	});

	test("self-referencing", () => {
		const value = new Set();
		value.add(value);
		value.add(1);
		const str = stringify(value);
		const deserialized = parse<Set<unknown>>(str);

		expect(deserialized).toEqual(value);
	});
});

test("URL", () => {
	const value = new URL(
		"https://user:pass@example.com:8080/path/to/page?query=value&other=123#section",
	);
	const str = stringify(value);
	const deserialized = parse<URL>(str);

	expect(deserialized).toEqual(value);
});

test("URLSearchParams", () => {
	const value = new URLSearchParams("a=1&b=2");
	const str = stringify(value);
	const deserialized = parse<URLSearchParams>(str);
	expect(deserialized).toEqual(value);
});

test("Headers", () => {
	const value = new Headers();
	value.append("a", "1");
	value.append("b", "2");
	const str = stringify(value);
	const deserialized = parse<Headers>(str);
	expect(deserialized).toEqual(value);
});

describe("TypedArray", () => {
	test("Int8Array", () => {
		const value = new Int8Array([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse<Int8Array>(str);
		expect(deserialized).toEqual(value);
	});

	test("BigInt64Array", () => {
		const value = new BigInt64Array([BigInt(1), BigInt(2), BigInt(3)]);
		const str = stringify(value);
		const deserialized = parse<BigInt64Array>(str);
		expect(deserialized).toEqual(value);
	});
});

test("undefined", () => {
	const value = undefined;
	const str = stringify(value);
	// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
	const deserialized = parse<undefined>(str);
	expect(deserialized).toBe(value);
});

describe("number", () => {
	test("Infinity", () => {
		const value = Infinity;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
	});

	test("-Infinity", () => {
		const value = -Infinity;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
	});

	test("-0", () => {
		const value = -0;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
	});
});
