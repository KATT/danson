import { expect, test } from "vitest";

import { serializeSync } from "./sync.js";

test("string", () => {
	const source = "hello";
	const meta = serializeSync(source);

	expect(meta.head).toBe(source);
	expect(meta.tail).toEqual([]);
});

test("number", () => {
	const source = 1;
	const meta = serializeSync(source);

	expect(meta.head).toBe(1);
	expect(meta.tail).toEqual([]);
});

test("object", () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
	};
	const meta = serializeSync(source);

	expect(meta.head).toEqual(source);
	expect(meta.tail).toEqual([]);
});

test("duplicate values", () => {
	const someObj1 = {
		a: 1,
	};
	const someObj2 = {
		b: 2,
	};

	const source = {
		1: someObj1,
		2: someObj1,
		3: someObj2,
		4: someObj2,
	};

	const meta = serializeSync(source);

	expect(meta.head).toEqual({
		1: "$1",
		2: "$1",
		3: "$2",
		4: "$2",
	});

	expect(meta.tail).toMatchInlineSnapshot(`
		[
		  [
		    1,
		    {
		      "a": 1,
		    },
		  ],
		  [
		    2,
		    {
		      "b": 2,
		    },
		  ],
		]
	`);
});

test("self-referencing object", () => {
	const source: Record<string, unknown> = {
		foo: "bar",
		self: null,
	};
	source.self = source;
	const meta = serializeSync(source);

	expect(meta.head).toEqual({
		foo: "bar",
		self: "$0",
	});
	expect(meta.tail).toEqual([]);
});

test.fails("fixme: custom types", () => {
	const source = {
		bigint: 1n,
	};

	const meta = serializeSync(source, {
		reducers: {
			BigInt: (value) => {
				if (typeof value !== "bigint") {
					return false;
				}
				return value.toString();
			},
		},
	});

	expect(meta.head).toEqual({
		bigint: "$1",
	});

	expect(meta.tail).toMatchInlineSnapshot();
});
