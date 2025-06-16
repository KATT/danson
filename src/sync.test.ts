import { Temporal } from "@js-temporal/polyfill";
import { expect, test } from "vitest";

import {
	deserializeSync,
	numberToRef,
	parseSync,
	serializeSync,
	stringifySync,
} from "./sync.js";
import { deserializers, serializers } from "./transformers.js";

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

test("object without prototype", () => {
	const source = Object.create(null);
	source.a = 1;
	source.b = 2;
	source.c = 3;
	const meta = serializeSync(source);

	expect(deserializeSync(meta)).toEqual(source);
});

test("dedupe", () => {
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

	const meta = serializeSync(source, {
		dedupe: true,
	});

	expect(meta.json).toEqual({
		1: numberToRef(1),
		2: numberToRef(1),
		3: numberToRef(2),
		4: numberToRef(2),
	});

	expect(meta.refs).toBeTruthy();
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
		self: numberToRef(0),
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

	expect(result.child.self).toBe(result.child);
});

test("custom simple type", () => {
	const source = {
		bigint: 1n,
	};

	const meta = serializeSync(source, {
		serializers,
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
		deserializers,
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
		serializers,
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
		deserializers,
	});

	expect(result).toEqual(source);
});

test("custom complex type with self reference", () => {
	const map = new Map<string, unknown>();
	map.set("a", 1);
	map.set("b", 2);

	const source = {
		map,
	};

	map.set("self", map);
	map.set("self2", map);

	const meta = serializeSync(source, {
		serializers,
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
		        [
		          "self2",
		          "$1",
		        ],
		      ],
		    },
		  },
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		deserializers,
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
		deserializers,
	});

	expect(result).toEqual(source);
});

test("stringify deduped object", () => {
	const obj = {
		a: 1,
		b: 2,
		c: 3,
	};
	const source = {
		obj,
		objAgain: obj,
	};

	const str = stringifySync(source, {
		dedupe: true,
		space: 2,
	});
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
		instant: Temporal.Now.instant(),
	};

	const str = stringifySync(source, {
		serializers: {
			"Temporal.Instant": (value) => {
				if (value instanceof Temporal.Instant) {
					return value.toJSON();
				}
				return false;
			},
		},
	});
	// console.log(str);

	const result = parseSync(str, {
		deserializers: {
			"Temporal.Instant": (value) => Temporal.Instant.from(value as string),
		},
	});
	expect(result).toEqual(source);
});

test("serialize/deserialize undefined", () => {
	const source = undefined;

	const obj = serializeSync(source, {
		serializers,
	});
	expect(obj).toMatchInlineSnapshot(`
		{
		  "json": {
		    "_": "$",
		    "type": "undef",
		    "value": 0,
		  },
		}
	`);

	// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
	const result = deserializeSync<typeof source>({ ...obj, deserializers });
	expect(result).toEqual(source);
});
