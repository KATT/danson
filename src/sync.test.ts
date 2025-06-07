import { expect, test } from "vitest";

import {
	deserializeSync,
	parseSync,
	serializeSync,
	stringifySync,
} from "./sync.js";

test("string", () => {
	const source = "hello";
	const meta = serializeSync(source);

	expect(meta.head).toBe(source);
	expect(meta.tail).toEqual({});
	expect(deserializeSync(meta)).toEqual(source);
});

test("number", () => {
	const source = 1;
	const meta = serializeSync(source);

	expect(meta.head).toBe(1);
	expect(meta.tail).toEqual({});

	expect(deserializeSync(meta)).toEqual(source);
});

test("object", () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
	};
	const meta = serializeSync(source);

	expect(meta.head).toEqual(source);
	expect(meta.tail).toEqual({});

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

	expect(meta.head).toEqual({
		1: "$1",
		2: "$1",
		3: "$2",
		4: "$2",
	});

	expect(meta.tail).toMatchInlineSnapshot(`
		{
		  "$1": {
		    "type": "ref",
		    "value": {
		      "a": 1,
		    },
		  },
		  "$2": {
		    "type": "ref",
		    "value": {
		      "b": 2,
		    },
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

	expect(meta.head).toEqual({
		foo: "bar",
		self: "$0",
	});
	expect(meta.tail).toEqual({});

	const result = deserializeSync<typeof source>(meta);

	expect(result).toEqual(source);
	expect(result.self).toBe(result);
});

test("custom simple type", () => {
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

	expect(meta.tail).not.toEqual({});
	expect(meta.tail).toMatchInlineSnapshot(`
		{
		  "$1": {
		    "reducerName": "BigInt",
		    "type": "reducer",
		    "value": "1",
		  },
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		revivers: {
			BigInt: (value) => BigInt(value as string),
		},
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

	expect(meta.head).toMatchInlineSnapshot(`
		{
		  "map": "$1",
		}
	`);

	expect(meta.tail).toMatchInlineSnapshot(`
		{
		  "$1": {
		    "reducerName": "Map",
		    "type": "reducer",
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

test("special handling - strings with $", () => {
	const source = {
		foo: "$1",
	};

	const meta = serializeSync(source);

	expect(meta.head).toEqual({
		foo: "$1",
	});

	expect(meta.tail).not.toEqual({});
	expect(meta.tail).toMatchInlineSnapshot(`
		{
		  "$1": {
		    "reducerName": "_$",
		    "type": "reducer",
		    "value": "$1",
		  },
		}
	`);
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
		  "head": {
		    "obj": "$1",
		    "objAgain": "$1"
		  },
		  "tail": {
		    "$1": {
		      "type": "ref",
		      "value": {
		        "a": 1,
		        "b": 2,
		        "c": 3
		      }
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
		  "head": {
		    "bigint": "$1"
		  },
		  "tail": {
		    "$1": {
		      "reducerName": "BigInt",
		      "type": "reducer",
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
