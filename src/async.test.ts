import { expect, test } from "vitest";

import {
	deserializeAsync,
	parseAsync,
	serializeAsync,
	stringifyAsync,
} from "./async.js";
import { reducers, revivers } from "./test.helpers.js";
import {
	aggregateAsyncIterable,
	serverResource,
	sleep,
	waitError,
} from "./test.utils.js";

test("serialize promise", async () => {
	const promise = (async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
		return "resolved promise";
	})();
	const source = () => ({
		promise,
		promiseAgain: promise,
	});

	const iterable = serializeAsync(source(), {
		reducers,
	});

	const aggregate = await aggregateAsyncIterable(iterable);

	expect(aggregate.error).toBeUndefined();

	expect(aggregate.items).toMatchInlineSnapshot(`
		[
		  {
		    "json": {
		      "promise": "$1",
		      "promiseAgain": "$1",
		    },
		    "refs": {
		      "$1": {
		        "_": "$",
		        "type": "Promise",
		        "value": 1,
		      },
		    },
		  },
		  [
		    1,
		    0,
		    {
		      "json": "resolved promise",
		      "refs": undefined,
		    },
		  ],
		]
	`);
});

test("serialize async iterable", async () => {
	const source = () => ({
		it1: (async function* () {
			yield 1;
		})(),
		it2: (async function* () {
			yield "a";
		})(),
	});

	const iterable = serializeAsync(source(), {
		reducers,
	});

	const aggregate = await aggregateAsyncIterable(iterable);

	expect(aggregate.error).toBeUndefined();

	expect(aggregate.items).toMatchInlineSnapshot(`
		[
		  {
		    "json": {
		      "it1": {
		        "_": "$",
		        "type": "AsyncIterable",
		        "value": 1,
		      },
		      "it2": {
		        "_": "$",
		        "type": "AsyncIterable",
		        "value": 2,
		      },
		    },
		    "refs": undefined,
		  },
		  [
		    1,
		    0,
		    {
		      "json": 1,
		      "refs": undefined,
		    },
		  ],
		  [
		    2,
		    0,
		    {
		      "json": "a",
		      "refs": undefined,
		    },
		  ],
		  [
		    1,
		    2,
		    {
		      "json": {
		        "_": "$",
		        "type": "undef",
		        "value": 0,
		      },
		      "refs": undefined,
		    },
		  ],
		  [
		    2,
		    2,
		    {
		      "json": {
		        "_": "$",
		        "type": "undef",
		        "value": 0,
		      },
		      "refs": undefined,
		    },
		  ],
		]
	`);
});

test("stringify promise", async () => {
	const source = () => ({
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return "resolved promise";
		})(),
	});

	const iterable = stringifyAsync(source(), {
		space: "\t",
	});

	const stringifyAggregate = await aggregateAsyncIterable(iterable);

	expect(stringifyAggregate.error).toBeUndefined();

	expect(stringifyAggregate.items).toMatchInlineSnapshot(`
		[
		  "{
			"json": {
				"promise": {
					"_": "$",
					"type": "Promise",
					"value": 1
				}
			}
		}
		",
		  "[
			1,
			0,
			{
				"json": "resolved promise"
			}
		]
		",
		]
	`);
	expect(stringifyAggregate.ok).toBe(true);
});

test("stringify promise returning Date", async () => {
	const source = () => ({
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return new Date(0);
		})(),
	});
	const iterable = stringifyAsync(source(), {
		reducers,
		space: "\t",
	});

	const stringifyAggregate = await aggregateAsyncIterable(iterable);

	expect(stringifyAggregate.error).toBeUndefined();

	expect(stringifyAggregate.items).toMatchInlineSnapshot(`
		[
		  "{
			"json": {
				"promise": {
					"_": "$",
					"type": "Promise",
					"value": 1
				}
			}
		}
		",
		  "[
			1,
			0,
			{
				"json": {
					"_": "$",
					"type": "Date",
					"value": "1970-01-01T00:00:00.000Z"
				}
			}
		]
		",
		]
	`);
	expect(stringifyAggregate.ok).toBe(true);
});

test("stringify async generator", async () => {
	const source = () => ({
		asyncIterable: (async function* () {
			await new Promise((resolve) => setTimeout(resolve, 0));
			yield 0;
			yield 1;
			yield 2;
			return "returned async iterable";
		})(),
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return "resolved promise";
		})(),
	});

	const iterable = stringifyAsync(source());

	const stringifyAggregate = await aggregateAsyncIterable(iterable);

	expect(stringifyAggregate.error).toBeUndefined();

	expect(stringifyAggregate.items.map((it) => it.trim()))
		.toMatchInlineSnapshot(`
			[
			  "{"json":{"asyncIterable":{"_":"$","type":"AsyncIterable","value":1},"promise":{"_":"$","type":"Promise","value":2}}}",
			  "[2,0,{"json":"resolved promise"}]",
			  "[1,0,{"json":0}]",
			  "[1,0,{"json":1}]",
			  "[1,0,{"json":2}]",
			  "[1,2,{"json":"returned async iterable"}]",
			]
		`);
	expect(stringifyAggregate.ok).toBe(true);
});

test("serialize and parse", async () => {
	const source = () => ({
		asyncIterable: (async function* () {
			await new Promise((resolve) => setTimeout(resolve, 0));
			yield 0;
			yield 1;
			yield 2;
			return "returned async iterable";
		})(),
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return "resolved promise";
		})(),
	});
	type Source = ReturnType<typeof source>;
	const serialized = serializeAsync(source(), {
		reducers,
	});

	const parsed = await deserializeAsync<Source>(serialized, {
		revivers,
	});
	const aggregate = await aggregateAsyncIterable(parsed.asyncIterable);

	expect(aggregate.ok).toBe(true);
	expect(aggregate.items).toEqual([0, 1, 2]);
	expect(aggregate.return).toEqual("returned async iterable");

	expect(await parsed.promise).toEqual("resolved promise");
});

test("stringify and parse", async () => {
	const source = () => ({
		asyncIterable: (async function* () {
			await new Promise((resolve) => setTimeout(resolve, 0));
			yield 0;
			yield 1;
			yield 2;
			return "returned async iterable";
		})(),
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			return "resolved promise";
		})(),
	});
	type Source = ReturnType<typeof source>;
	const iterable = stringifyAsync(source(), {
		reducers,
		space: "\t",
	});

	const parsed = await parseAsync<Source>(iterable, {
		revivers,
	});
	const aggregate = await aggregateAsyncIterable(parsed.asyncIterable);

	expect(aggregate.ok).toBe(true);
	expect(aggregate.items).toEqual([0, 1, 2]);
	expect(aggregate.return).toEqual("returned async iterable");

	expect(await parsed.promise).toEqual("resolved promise");
});

test("stringify and parse async values with errors - simple", async () => {
	class MyCustomError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "MyCustomError";
		}
	}

	class UnregisteredError extends Error {
		constructor(cause: unknown) {
			const message = cause instanceof Error ? cause.message : String(cause);
			super(message, { cause });
			this.name = "UnregisteredError";
		}
	}

	const source = () => ({
		asyncIterable: (async function* () {
			yield 0;
			yield 1;
			throw new MyCustomError("error in async iterable");
		})(),
	});
	type Source = ReturnType<typeof source>;

	const iterable = stringifyAsync(source(), {
		coerceError: (error) => {
			return new UnregisteredError(error);
		},
		reducers: {
			MyCustomError: (value) => {
				if (value instanceof MyCustomError) {
					return value.message;
				}
				return false;
			},
			UnregisteredError: (value) => {
				if (value instanceof UnregisteredError) {
					return [value.message];
				}
				return false;
			},
		},
	});

	const result = await parseAsync<Source>(iterable, {
		revivers: {
			MyCustomError: (value) => {
				return new MyCustomError(value as string);
			},
			UnregisteredError: (...args) => {
				return new UnregisteredError(...args);
			},
		},
	});

	const aggregate = await aggregateAsyncIterable(result.asyncIterable);

	expect(aggregate.ok).toBe(false);
	expect(aggregate.error).toBeInstanceOf(MyCustomError);
	expect(aggregate.items).toEqual([0, 1]);
	expect(aggregate.return).toBeUndefined();
});

test("stringify and parse async values with errors", async () => {
	class MyCustomError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "MyCustomError";
		}
	}

	class UnregisteredError extends Error {
		constructor(cause: unknown) {
			const message = cause instanceof Error ? cause.message : String(cause);
			super(message, { cause });
			this.name = "UnregisteredError";
		}
	}

	const source = () => ({
		asyncIterable: (async function* () {
			await new Promise((resolve) => setTimeout(resolve, 0));
			yield "yield";
			throw new MyCustomError("error in async iterable");
		})(),
		promise: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			throw new MyCustomError("error in promise");
		})(),
		unknownErrorDoesNotBlockStream: (async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			throw new Error("unknown error"); // <-- this is not handled by the reviver, but coerceError is provided
		})(),
	});
	type Source = ReturnType<typeof source>;

	const iterable = stringifyAsync(source(), {
		coerceError: (error) => {
			return new UnregisteredError(error);
		},
		reducers: {
			MyCustomError: (value) => {
				if (value instanceof MyCustomError) {
					return value.message;
				}
				return false;
			},
			UnregisteredError: (value) => {
				if (value instanceof UnregisteredError) {
					return [value.message];
				}
				return false;
			},
		},
	});

	const result = await parseAsync<Source>(iterable, {
		revivers: {
			MyCustomError: (value) => {
				return new MyCustomError(value as string);
			},
			UnregisteredError: (...args) => {
				return new UnregisteredError(...args);
			},
		},
	});

	{
		const err = await waitError(
			result.unknownErrorDoesNotBlockStream,
			UnregisteredError,
		);
		expect(err).toMatchInlineSnapshot(`[UnregisteredError: unknown error]`);
	}
	{
		const err = await waitError(result.promise, MyCustomError);
		expect(err).toMatchInlineSnapshot(`[MyCustomError: error in promise]`);
	}
	{
		const aggregate = await aggregateAsyncIterable(result.asyncIterable);

		expect(aggregate.ok).toBe(false);

		expect(aggregate.error).toBeInstanceOf(MyCustomError);

		expect(aggregate.items).toEqual(["yield"]);
	}
});

test("stringify and parse ReadableStream", async () => {
	const source = () => ({
		stream: new ReadableStream<string>({
			async pull(controller) {
				controller.enqueue("hello");
				controller.enqueue("world");
				controller.close();
			},
		}),
	});
	type Source = ReturnType<typeof source>;

	const iterable = stringifyAsync(source(), {
		reducers,
	});
	const result = await parseAsync<Source>(iterable, {
		revivers,
	});

	expect(result.stream).toBeInstanceOf(ReadableStream);

	const aggregate = await aggregateAsyncIterable(result.stream);

	expect(aggregate.error).toBeUndefined();
	expect(aggregate.ok).toBe(true);
	expect(aggregate.items).toEqual(["hello", "world"]);
	expect(aggregate.return).toBeUndefined();
});

test("async over the wire", async () => {
	const source = () => ({
		asyncIterable: (async function* () {
			yield "hello";
			await sleep(1);
			yield "world";

			return "returned async iterable";
		})(),
	});
	type Source = ReturnType<typeof source>;
	using server = serverResource((req, res) => {
		(async () => {
			for await (const chunk of stringifyAsync(source())) {
				res.write(chunk);
			}
			res.end();
		})().catch(console.error);
	});

	{
		const response = await fetch(server.url);

		expect(response.ok).toBe(true);

		const bodyTextStream = response.body!.pipeThrough(new TextDecoderStream());

		const aggregate = await aggregateAsyncIterable(bodyTextStream);

		const conc = aggregate.items.join("").split("\n");

		expect(conc).toMatchInlineSnapshot(`
			[
			  "{"json":{"asyncIterable":{"_":"$","type":"AsyncIterable","value":1}}}",
			  "[1,0,{"json":"hello"}]",
			  "[1,0,{"json":"world"}]",
			  "[1,2,{"json":"returned async iterable"}]",
			  "",
			]
		`);
	}
	{
		const response = await fetch(server.url);

		expect(response.ok).toBe(true);

		const bodyTextStream = response.body!.pipeThrough(new TextDecoderStream());

		const result = await parseAsync<Source>(bodyTextStream);

		const aggregate = await aggregateAsyncIterable(result.asyncIterable);

		expect(aggregate.ok).toBe(true);
		expect(aggregate.items).toEqual(["hello", "world"]);
		expect(aggregate.return).toEqual("returned async iterable");
	}
});

test("dedupe", async () => {
	const user = {
		id: 1,
	};

	const promise = Promise.resolve(user);

	const source = () => ({
		promise1: promise,
		promise2: promise,
	});
	type Source = ReturnType<typeof source>;

	{
		const aggregate = await aggregateAsyncIterable(stringifyAsync(source()));

		const conc = aggregate.items.join("").split("\n");

		expect(conc).toMatchInlineSnapshot(`
			[
			  "{"json":{"promise1":"$1","promise2":"$1"},"refs":{"$1":{"_":"$","type":"Promise","value":1}}}",
			  "[1,0,{"json":{"id":1}}]",
			  "",
			]
		`);
	}

	{
		const iterable = stringifyAsync(source());

		const result = await parseAsync<Source>(iterable);

		expect(result.promise1).toStrictEqual(result.promise2);

		expect(await result.promise1).toEqual(user);
	}
});

test("nested async values", async () => {
	interface Comment {
		content: string;
		user: string;
	}

	async function getComments(): Promise<Comment[]> {
		return [
			{
				content: "comment 1",
				user: "KATT",
			},
		];
	}

	const source = () => ({
		post: Promise.resolve({
			comments: getComments(),
			id: 1,
			title: "post title",
		}),
	});
	type Source = ReturnType<typeof source>;

	const iterable = stringifyAsync(source());

	const result = await parseAsync<Source>(iterable);

	const promise = await result.post;
	expect(promise).toMatchInlineSnapshot(`
		{
		  "comments": Promise {},
		  "id": 1,
		  "title": "post title",
		}
	`);

	const comments = await promise.comments;
	expect(comments).toMatchInlineSnapshot(`
		[
		  {
		    "content": "comment 1",
		    "user": "KATT",
		  },
		]
	`);
});

test.fails("todo(?) - referential integrity across chunks", async () => {
	const user = {
		id: 1,
	};

	const source = () => ({
		asyncIterable: (async function* () {
			yield user;
			yield user;
		})(),
	});
	type Source = ReturnType<typeof source>;

	const result = await parseAsync<Source>(stringifyAsync(source()));

	const aggregate = await aggregateAsyncIterable(result.asyncIterable);

	expect(aggregate.ok).toBe(true);

	expect(aggregate.return).toBeUndefined();

	expect(aggregate.items[0]).toBe(aggregate.items[1]);
});

test("custom type", async () => {
	class Vector {
		constructor(
			public x: number,
			public y: number,
		) {}
	}

	const source = () => ({
		// undefined,
		vectors: (async function* () {
			yield new Vector(1, 2);
			yield new Vector(3, 4);
		})(),
	});
	type Source = ReturnType<typeof source>;

	const iterable = stringifyAsync(source(), {
		reducers: {
			...reducers,
			Vector: (value) => value instanceof Vector && [value.x, value.y],
		},
		space: "\t",
	});
	{
		const result = await parseAsync<Source>(iterable, {
			revivers: {
				...revivers,
				Vector: (value) => {
					const [x, y] = value as [number, number];
					return new Vector(x, y);
				},
			},
		});

		const aggregate = await aggregateAsyncIterable(result.vectors);

		expect(aggregate.error).toBeFalsy();
		expect(aggregate.ok).toBe(true);
		expect(aggregate.items).toEqual([new Vector(1, 2), new Vector(3, 4)]);
	}
});
