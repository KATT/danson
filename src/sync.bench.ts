import * as superjson from "superjson";
import { bench, describe } from "vitest";

import { deserializers, serializers } from "./std.js";
import { parseSync, stringifySync } from "./sync.js";

const obj = {
	array: [{ foo: 1 }, { bar: 2 }, { baz: 3 }],
	date: new Date(),
	number: 42,
	regex: /the quick brown fox/,
	set: new Set([1, 2, 3]),
	xss: '</script><script>alert("XSS")</script>',
};

(obj as any).self = obj;

describe("stringify", () => {
	bench("danson", () => {
		stringifySync(obj, {
			serializers,
		});
	});

	bench("superjson", () => {
		superjson.stringify(obj);
	});
});

describe("stringify + parse", () => {
	bench("danson", () => {
		parseSync(
			stringifySync(obj, {
				serializers,
			}),
			{
				deserializers,
			},
		);
	});

	bench("superjson", () => {
		superjson.parse(superjson.stringify(obj));
	});
});
