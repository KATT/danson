import { expect, expectTypeOf, test } from "vitest";

import {
	parseEventStream,
	stringifyEventStream,
} from "./async.event-stream.js";
import { aggregateAsyncIterable } from "./test.utils.js";

test("stringifyEventStream", async () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
		Promise: Promise.resolve(4),
	};

	const stream = stringifyEventStream(source);

	const aggregated = await aggregateAsyncIterable(stream);
	expect(aggregated.items.map((it) => it.trim())).toMatchInlineSnapshot(`
		[
		  "data:{"json":{"a":1,"b":2,"c":3,"Promise":{"_":"$","type":"Promise","value":1}}}",
		  "data:[1,0,{"json":4}]",
		]
	`);
});

test("stringify + parse", async () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
		Promise: Promise.resolve(4),
	};

	const stream = stringifyEventStream(source);
	const parsed = await parseEventStream(stream);

	expect(parsed).toEqual(source);
	expect(parsed.Promise).toBeInstanceOf(Promise);
	expect(await parsed.Promise).toBe(4);
});

test("magic types", async () => {
	const source = {
		a: 1,
		b: 2,
		c: 3,
		Promise: Promise.resolve(4),
	};

	const stream = stringifyEventStream(source);
	const parsed = await parseEventStream(stream);

	expectTypeOf(parsed).toEqualTypeOf<typeof source>();
});
