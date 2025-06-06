import { expect, test } from "vitest";

import { stringifySync } from "./sync.js";

test("string", () => {
	const source = "hello";
	const [str] = stringifySync(source);

	expect(str).toBe(`"${source}"`);

	expect(JSON.parse(str)).toEqual(source);
});

test("number", () => {
	const source = 1;
	const [str] = stringifySync(source);

	expect(str).toBe("1");

	expect(JSON.parse(str)).toEqual(source);
});

test("object", () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
	};
	const [str, meta] = stringifySync(source);

	expect(meta.head).toMatchInlineSnapshot(`"{"a":1,"b":2,"c":3}"`);

	expect(str).toBe(`{"a":1,"b":2,"c":3}`);

	expect(JSON.parse(str)).toEqual(source);
});

test("duplicate", () => {
	const someObj = {
		foo: "bar",
	};

	const source = {
		a: someObj,
		b: someObj,
	};

	const [str, meta] = stringifySync(source);

	expect(meta.head).toMatchInlineSnapshot(`
		"{"a":
		2
		,"b":
		2
		}"
	`);
	expect(meta.tail).toMatchInlineSnapshot(`
		[
		  [
		    2,
		    "{"foo":"bar"}",
		  ],
		  [
		    2,
		    "
		2
		",
		  ],
		]
	`);
	expect(str).toMatchInlineSnapshot(`
		"{"a":
		2
		,"b":
		2
		}"
	`);
});
test("self-referencing object", () => {
	const source: Record<string, unknown> = {
		foo: "bar",
		self: null,
	};
	source.self = source;
	const [str, meta] = stringifySync(source);

	expect(meta.head).toMatchInlineSnapshot(`
		"{"foo":"bar","self":
		1
		}"
	`);
	expect(meta.tail).toMatchInlineSnapshot(`
		[
		  [
		    1,
		    "
		1
		",
		  ],
		]
	`);
});
