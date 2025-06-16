import { describe, expect, it } from "vitest";

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

describe("BigInt", () => {
	it("BigInt", () => {
		const value = BigInt(123);
		const str = stringify(value);
		const deserialized = parse<bigint>(str);
		expect(deserialized).toBe(value);
	});
});

describe("Date", () => {
	it("Date", () => {
		const value = new Date("2024-01-01T00:00:00.000Z");
		const str = stringify(value);
		const deserialized = parse<Date>(str);
		expect(deserialized).toEqual(value);
	});
});

describe("Map", () => {
	it("Map", () => {
		const value = new Map([
			["a", 1],
			["b", 2],
		]);
		const str = stringify(value);
		const deserialized = parse<Map<string, number>>(str);
		expect(deserialized).toEqual(value);
	});

	it("self-referencing Map", () => {
		const value = new Map();
		value.set("self", value);
		value.set("a", 1);
		const str = stringify(value);
		const deserialized = parse<Map<string, unknown>>(str);

		expect(deserialized).toEqual(value);
	});
});

describe("RegExp", () => {
	it("RegExp", () => {
		const value = /test/i;
		const str = stringify(value);
		const deserialized = parse<RegExp>(str);
		expect(deserialized).toEqual(value);
	});
});

describe("Set", () => {
	it("Set", () => {
		const value = new Set([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse<Set<number>>(str);
		expect(deserialized).toEqual(value);
	});

	it("self-referencing Set", () => {
		const value = new Set();
		value.add(value);
		value.add(1);
		const str = stringify(value);
		const deserialized = parse<Set<unknown>>(str);

		expect(deserialized).toEqual(value);
	});
});

describe("URL", () => {
	it("URL", () => {
		const value = new URL(
			"https://user:pass@example.com:8080/path/to/page?query=value&other=123#section",
		);
		const str = stringify(value);
		const deserialized = parse<URL>(str);

		expect(deserialized).toEqual(value);
	});
});

describe("URLSearchParams", () => {
	it("URLSearchParams", () => {
		const value = new URLSearchParams("a=1&b=2");
		const str = stringify(value);
		const deserialized = parse<URLSearchParams>(str);
		expect(deserialized).toEqual(value);
	});
});

describe("Headers", () => {
	it("Headers", () => {
		const value = new Headers();
		value.append("a", "1");
		value.append("b", "2");
		const str = stringify(value);
		const deserialized = parse<Headers>(str);
		expect(deserialized).toEqual(value);
	});
});

describe("TypedArray", () => {
	it("Int8Array", () => {
		const value = new Int8Array([1, 2, 3]);
		const str = stringify(value);
		const deserialized = parse<Int8Array>(str);
		expect(deserialized).toEqual(value);
	});

	it("BigInt64Array", () => {
		const value = new BigInt64Array([BigInt(1), BigInt(2), BigInt(3)]);
		const str = stringify(value);
		const deserialized = parse<BigInt64Array>(str);
		expect(deserialized).toEqual(value);
	});
});

describe("undefined", () => {
	it("undefined", () => {
		const value = undefined;
		const str = stringify(value);
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
		const deserialized = parse<undefined>(str);
		expect(deserialized).toBe(value);
	});
});

describe("number", () => {
	it("Infinity", () => {
		const value = Infinity;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
	});

	it("-Infinity", () => {
		const value = -Infinity;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
	});

	it("-0", () => {
		const value = -0;
		const str = stringify(value);
		const deserialized = parse<number>(str);
		expect(deserialized).toBe(value);
		expect(Object.is(deserialized, -0)).toBe(true);
	});
});
