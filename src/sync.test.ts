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

test("self-referencing object", () => {
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

test("custom complex type", () => {
	const map = new Map<string, number>();
	map.set("a", 1);
	map.set("b", 2);

	const source = {
		map,
	};

	const meta = serializeSync(source, {
		reducers: {
			Map: (value) => {
				if (value instanceof Map) {
					return Array.from(value.entries());
				}
				return false;
			},
		},
	});

	expect(meta).toMatchInlineSnapshot(`
		{
		  "json": {
		    "map": {
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
		      ],
		    },
		  },
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		revivers: {
			Map: (value) => {
				return new Map(value as [unknown, unknown][]);
			},
		},
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
		space: 2,
	});
	expect(str).toMatchInlineSnapshot(`
		"{
		  "json": {
		    "bigint": {
		      "_": "$",
		      "type": "BigInt",
		      "value": "1"
		    }
		  },
		  "refs": {}
		}"
	`);

	const result = parseSync(str, {
		revivers: {
			BigInt: (value) => BigInt(value as string),
		},
	});
	expect(result).toEqual(source);
});
