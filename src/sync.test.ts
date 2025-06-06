import { expect, test } from "vitest";

import { stringifySync } from "./sync.js";

test("string", () => {
	const source = "hello";
	const meta = stringifySync(source);

	expect(meta.head).toBe(`"${source}"`);

	expect(JSON.parse(meta.head)).toEqual(source);
	expect(meta.tail).toEqual([]);
});

test("number", () => {
	const source = 1;
	const meta = stringifySync(source);

	expect(meta.head).toBe("1");

	expect(JSON.parse(meta.head)).toEqual(source);
});

test("object", () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
	};
	const meta = stringifySync(source);

	expect(meta.head).toMatchInlineSnapshot(`"{"a":1,"b":2,"c":3}"`);

	expect(meta.head).toBe(`{"a":1,"b":2,"c":3}`);

	expect(JSON.parse(meta.head)).toEqual(source);
});

test("duplicate values", () => {
	const someObj = {
		foo: "bar",
	};

	const source = {
		a: someObj,
		b: someObj,
		c: someObj,
	};

	const meta = stringifySync(source);

	expect(JSON.parse(meta.head)).toEqual({
		a: "$1",
		b: "$1",
		c: "$1",
	});

	expect(meta.tail).toMatchInlineSnapshot(`
		[
		  [
		    1,
		    "{"foo":"bar"}",
		  ],
		]
	`);
	expect(meta.head).toMatchInlineSnapshot(`"{"a":"$1","b":"$1","c":"$1"}"`);
});

test("duplicate keys", () => {
	const key = "someReallyLongObnoxiousKey";
	const source = [
		{
			[key]: 1,
		},
		{
			[key]: 2,
		},
	];

	const meta = stringifySync(source);

	expect(meta.head).toMatchInlineSnapshot(
		`"[{"someReallyLongObnoxiousKey":1},{"someReallyLongObnoxiousKey":2}]"`,
	);
	expect(meta.tail).toMatchInlineSnapshot(`[]`);
	expect(meta.head).toMatchInlineSnapshot(
		`"[{"someReallyLongObnoxiousKey":1},{"someReallyLongObnoxiousKey":2}]"`,
	);
});

test("self-referencing object", () => {
	const source: Record<string, unknown> = {
		foo: "bar",
		self: null,
	};
	source.self = source;
	const meta = stringifySync(source);

	expect(JSON.parse(meta.head)).toEqual({
		foo: "bar",
		self: "$0",
	});
	expect(meta.tail).toEqual([]);
});
