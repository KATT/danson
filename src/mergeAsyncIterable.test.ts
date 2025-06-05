import { expect, test } from "vitest";

import { createDeferred } from "./createDeferred.js";
import { mergeAsyncIterables } from "./mergeAsyncIterable.js";
import { aggregateAsyncIterable, waitError } from "./test.utils.js";

test("basic", async () => {
	type Type = number | string;
	const merged = mergeAsyncIterables<Type>();

	merged.add(
		(async function* () {
			yield "a";
			yield "b";
			yield "c";
		})(),
	);
	merged.add(
		(async function* () {
			yield 1;
			yield 2;
			yield 3;
		})(),
	);

	const aggregate = await aggregateAsyncIterable(merged);

	expect(aggregate.ok).toBe(true);
	expect(aggregate.items).toEqual(["a", 1, "b", 2, "c", 3]);
});

test("while iterating", async () => {
	type Type = number | string;
	const merged = mergeAsyncIterables<Type>();

	merged.add(
		(async function* () {
			yield "a";
			yield "b";
			yield "c";
		})(),
	);

	const deferred = createDeferred();
	const aggregatePromise = aggregateAsyncIterable(
		(async function* () {
			for await (const value of merged) {
				if (value === "b") {
					deferred.resolve();
				}
				yield value;
			}
		})(),
	);

	await deferred.promise;

	merged.add(
		(async function* () {
			yield 1;
			yield 2;
			yield 3;
		})(),
	);

	const aggregate = await aggregatePromise;

	expect(aggregate.ok).toBe(true);
	expect(aggregate.items).toEqual([
		//
		"a",
		"b",
		1,
		"c",
		2,
		3,
	]);
	expect(aggregate.return).toBeUndefined();
});

test("failed cleanup", async () => {
	const merged = mergeAsyncIterables<string>();

	merged.add({
		[Symbol.asyncIterator]: () => {
			const queue = ["a", "b", "c"];
			const iterator: AsyncIterator<string> = {
				async next() {
					const n = queue.shift();
					if (n === undefined) {
						return {
							done: true,
							value: undefined,
						};
					}
					return {
						done: false,
						value: n,
					};
				},
				async return() {
					throw new Error("failed return");
				},
			};

			return iterator;
		},
	});

	const error = await waitError(async () => {
		for await (const value of merged) {
			if (value === "b") {
				break;
			}
		}
	}, AggregateError);

	expect(error).toBeInstanceOf(AggregateError);
	expect(error.errors).toMatchInlineSnapshot(`
		[
		  [Error: failed return],
		]
	`);
});
