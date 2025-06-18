import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, expectTypeOf, test } from "vitest";

import { deserializers, serializers } from "./std.js";
import {
	CommonOptions,
	CustomValue,
	deserializeSync,
	numberToRef,
	parseSync,
	PlaceholderValue,
	SerializeReturn,
	serializeSync,
	stringifySync,
	TransformerPair,
} from "./sync.js";

const common: Required<CommonOptions> = {
	prefix: "$",
	suffix: "",
};

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

	const result = deserializeSync(meta);

	expect(result).toEqual(source);
	expectTypeOf(result).toEqualTypeOf<typeof source>();
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
		1: numberToRef(1, common),
		2: numberToRef(1, common),
		3: numberToRef(2, common),
		4: numberToRef(2, common),
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
		self: numberToRef(0, common),
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

	const result = deserializeSync<typeof source>(meta, {
		deserializers,
	});

	expect(result).toEqual(source);
});

describe("special handling - ref-like strings", () => {
	test("$1", () => {
		const source = "$1";

		const meta = serializeSync(source);

		const result = deserializeSync<typeof source>(meta, {
			deserializers,
		});

		expect(result).toBe(source);
	});

	test("$", () => {
		const source = {
			_: "$" as PlaceholderValue,
			type: "BigInt" as any,
			value: "1",
		} satisfies CustomValue;

		const serialized = serializeSync(source, {
			serializers,
		});

		const result = deserializeSync(serialized, {
			deserializers,
		});

		expect(result).toEqual(source);

		expect(serialized).toMatchInlineSnapshot(`
			{
			  "json": {
			    "_": {
			      "_": "$",
			      "type": "string",
			      "value": "$",
			    },
			    "type": "BigInt",
			    "value": "1",
			  },
			}
		`);
	});
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
	type TemporalNow = TransformerPair<Temporal.Instant, string>;

	const serializeTemporalNow: TemporalNow["serialize"] = (value) => {
		if (value instanceof Temporal.Instant) {
			return value.toJSON();
		}
		return false;
	};

	const deserializeTemporalNow: TemporalNow["deserialize"] = (value) => {
		return Temporal.Instant.from(value);
	};

	const source = {
		instant: Temporal.Now.instant(),
	};

	const str = stringifySync(source, {
		serializers: {
			"Temporal.Instant": serializeTemporalNow,
		},
	});

	const result = parseSync(str, {
		deserializers: {
			"Temporal.Instant": deserializeTemporalNow,
		},
	});
	expect(result).toEqual(source);
});

describe("magic types", () => {
	test("stringify + parse", () => {
		const source = {
			foo: "bar",
		};

		const str = stringifySync(source);

		const result = parseSync(str);

		expectTypeOf(result).toEqualTypeOf<typeof source>();
	});

	test("serialize + deserialize", () => {
		const source = {
			foo: "bar",
		};

		const obj = serializeSync(source);
		const result = deserializeSync(obj);

		expectTypeOf(result).toEqualTypeOf<typeof source>();
	});

	test("manual stringify + parse", () => {
		const source = {
			foo: "bar",
		};

		const str = stringifySync(source);
		const result = parseSync<typeof source>(str as string);

		expectTypeOf(result).toEqualTypeOf<typeof source>();
	});

	test("manual serialize + deserialize", () => {
		const source = {
			foo: "bar",
		};

		const obj = serializeSync(source);
		const result = deserializeSync<typeof source>(obj as SerializeReturn);

		expectTypeOf(result).toEqualTypeOf<typeof source>();
	});
});

test("serialize/deserialize undefined at top level", () => {
	const source = undefined;

	const obj = serializeSync(source);
	expect(obj).toEqual({});

	// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
	const result = deserializeSync(obj);
	expect(result).toEqual(source);
});

test("custom prefix/suffix", () => {
	const common: Required<CommonOptions> = {
		prefix: "@@",
		suffix: "@@",
	};

	const source = {
		bigint: 1n,
		collisions: ["@@foo@@", "@@", "@@@@", "@@undefined@@"],
		undef: undefined,
	};

	const serialized = serializeSync(source, {
		...common,
		serializers,
	});

	const result = deserializeSync(serialized, {
		...common,
		deserializers,
	});

	expect(result).toEqual(source);

	expect(serialized).toMatchInlineSnapshot(`
		{
		  "json": {
		    "bigint": {
		      "_": "@@@@",
		      "type": "BigInt",
		      "value": "1",
		    },
		    "collisions": [
		      {
		        "_": "@@@@",
		        "type": "string",
		        "value": "@@foo@@",
		      },
		      "@@",
		      {
		        "_": "@@@@",
		        "type": "string",
		        "value": "@@@@",
		      },
		      {
		        "_": "@@@@",
		        "type": "string",
		        "value": "@@undefined@@",
		      },
		    ],
		    "undef": "@@undefined@@",
		  },
		}
	`);
});

test("null properties", () => {
	const source = {
		foo: null,
	};

	const serialized = stringifySync(source);
	const result = parseSync(serialized);

	expect(result).toEqual(source);
});
