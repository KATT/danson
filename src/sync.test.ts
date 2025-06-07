import { expect, test } from "vitest";

import {
	deserializeSync,
	parseSync,
	serializeSync,
	stringifySync,
} from "./sync.js";
import { reducers, revivers } from "./test.helpers.js";

test("string", () => {
	const source = "hello";
	const meta = serializeSync(source);

	expect(meta.json).toBe(source);
	expect(meta.refs).toBeUndefined();
	expect(deserializeSync(meta)).toEqual(source);
});

test("number", () => {
	const source = 1;
	const meta = serializeSync(source);

	expect(meta.json).toBe(1);
	expect(meta.refs).toBeUndefined();

	expect(deserializeSync(meta)).toEqual(source);
});

test("object", () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
	};
	const meta = serializeSync(source);

	expect(meta.json).toEqual(source);
	expect(meta.refs).toBeUndefined();

	expect(deserializeSync(meta)).toEqual(source);
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

	expect(meta.json).toEqual({
		1: "$1",
		2: "$1",
		3: "$2",
		4: "$2",
	});

	expect(meta.refs).toMatchInlineSnapshot(`
		{
		  "$1": {
		    "a": 1,
		  },
		  "$2": {
		    "b": 2,
		  },
		}
	`);

	expect(deserializeSync(meta)).toEqual(source);
});

test("self-referencing object at top", () => {
	const source: Record<string, unknown> = {
		foo: "bar",
		self: null,
	};
	source.self = source;
	const meta = serializeSync(source);

	expect(meta.json).toEqual({
		foo: "bar",
		self: "$0",
	});
	expect(meta.refs).toBeUndefined();

	const result = deserializeSync<typeof source>(meta);

	expect(result).toEqual(source);
	expect(result.self).toBe(result);
});

test("self-referencing object in object", () => {
	const child: any = {
		foo: "bar",
		self: null,
	};
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	child.self = child;

	const source: any = {
		child,
	};

	const meta = serializeSync(source);

	expect(meta).toMatchInlineSnapshot(`
		{
		  "json": {
		    "child": "$1",
		  },
		  "refs": {
		    "$1": {
		      "foo": "bar",
		      "self": "$1",
		    },
		  },
		}
	`);

	const result = deserializeSync<typeof source>(meta);

	expect(result).toEqual(source);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	expect(result.child.self).toBe(result.child);
});

test("custom simple type", () => {
	const source = {
		bigint: 1n,
	};

	const meta = serializeSync(source, {
		reducers,
	});

	expect(meta.json).toMatchInlineSnapshot(`
		{
		  "bigint": {
		    "_": "$",
		    "type": "BigInt",
		    "value": "1",
		  },
		}
	`);

	expect(meta.refs).toBeUndefined();

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
});

test("map", () => {
	const source = {
		map: new Map<string, unknown>([
			["bigint", 1n],
			["foo", "bar"],
		]),
	};

	const meta = serializeSync(source, {
		reducers,
	});

	expect(meta.json).toMatchInlineSnapshot(`
		{
		  "map": {
		    "_": "$",
		    "type": "Map",
		    "value": [
		      [
		        "bigint",
		        {
		          "_": "$",
		          "type": "BigInt",
		          "value": "1",
		        },
		      ],
		      [
		        "foo",
		        "bar",
		      ],
		    ],
		  },
		}
	`);

	expect(meta.refs).toBeUndefined();

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
});

test.fails("fixme: custom complex type with self reference", () => {
	const map = new Map<string, unknown>();
	map.set("a", 1);
	map.set("b", 2);

	const source = {
		map,
	};

	map.set("self", map);

	const meta = serializeSync(source, {
		reducers,
	});

	expect(meta).toMatchInlineSnapshot(`
		{
		  "json": {
		    "map": "$1",
		  },
		  "refs": {
		    "$1": {
		      "_": "$",
		      "type": "Map",
		      "value": [
		        [
		          "a",
		          1,
		        ],
		        [
		          "b",
		          2,
		        ],
		        [
		          "self",
		          "$1",
		        ],
		      ],
		    },
		  },
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
});

test("special handling - ref-like strings", () => {
	const source = {
		foo: "$1",
	};

	const meta = serializeSync(source);

	expect(meta).toMatchInlineSnapshot(`
		{
		  "json": {
		    "foo": {
		      "_": "$",
		      "type": "string",
		      "value": "$1",
		    },
		  },
		  "refs": undefined,
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
});

test("stringify object", () => {
	const obj = {
		a: 1,
		b: 2,
		c: 3,
	};
	const source = {
		obj,
		objAgain: obj,
	};

	const str = stringifySync(source, { space: 2 });
	expect(str).toMatchInlineSnapshot(`
		"{
		  "json": {
		    "obj": "$1",
		    "objAgain": "$1"
		  },
		  "refs": {
		    "$1": {
		      "a": 1,
		      "b": 2,
		      "c": 3
		    }
		  }
		}"
	`);

	const result = parseSync(str);
	expect(result).toEqual(source);
});

test("stringify custom type", () => {
	const source = {
		bigint: 1n,
	};

	const str = stringifySync(source, {
		reducers: {
			BigInt: (value) => {
				if (typeof value !== "bigint") {
					return false;
				}
				return value.toString();
			},
		},
		space: "\t",
	});
	expect(str).toMatchInlineSnapshot(`
		"{
			"json": {
				"bigint": {
					"_": "$",
					"type": "BigInt",
					"value": "1"
				}
			}
		}"
	`);

	const result = parseSync(str, {
		revivers: {
			BigInt: (value) => BigInt(value as string),
		},
	});
	expect(result).toEqual(source);
});
