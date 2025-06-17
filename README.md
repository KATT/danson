<h1 align="center">danSON</h1>

<p align="center">Progressive JSON</p>

<p align="center">
	<a href="https://github.com/KATT/danson/blob/main/.github/CODE_OF_CONDUCT.md" target="_blank"><img alt="🤝 Code of Conduct: Kept" src="https://img.shields.io/badge/%F0%9F%A4%9D_code_of_conduct-kept-21bb42" /></a>
	<a href="https://codecov.io/gh/KATT/danson" target="_blank"><img alt="🧪 Coverage" src="https://img.shields.io/codecov/c/github/KATT/danson?label=%F0%9F%A7%AA%20coverage" /></a>
	<a href="https://github.com/KATT/danson/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg" /></a>
	<a href="http://npmjs.com/package/danson" target="_blank"><img alt="📦 npm version" src="https://img.shields.io/npm/v/danson?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
</p>

## About

danSON is a progressive JSON serializer and deserializer that can serialize and deserialize arbitrary objects into JSON.

## Features

- Streaming of `Promise`s, `AsyncIterable`s, and `ReadableStream`s
- Custom serializers / deserializers
- De-duplication of objects (optional)
- Circular references
- Built-in serializers for common JavaScript types:
  - `BigInt`
  - `Date`
  - `Headers`
  - `Map`
  - Special numbers (`-0`, `Infinity`, `-Infinity`)
  - `RegExp`
  - `Set`
  - TypedArrays (`Int8Array`, `Uint8Array`, etc.)
  - `undefined`
  - `URL`
  - `URLSearchParams`

## Installation

```shell
npm install danson
```

## Examples

[Try the example on StackBlitz](https://stackblitz.com/github/KATT/danson/tree/main/example)

### Serializing custom objects

```ts
import { Temporal } from "@js-temporal/polyfill";
import { parseSync, stringifySync } from "danson";

const source = {
	instant: Temporal.Now.instant(),
};

const stringified = stringifySync(source, {
	serializers: {
		"Temporal.Instant": (value) => value.toJSON(),
	},
	space: 2,
});
/*
{
	"json": {
		"instant": {
			"_": "$",
			"type": "Temporal.Instant",
			"value": "2025-06-13T15:24:51.30029128Z"
		}
	}
}
*/

const result = parseSync<typeof source>(stringified, {
	deserializers: {
		"Temporal.Instant": (value) => Temporal.Instant.from(value as string),
	},
});
```

### Streaming `Promise`s

#### Promise example input

```ts
const source = {
	foo: "bar",
	promise: (async () => {
		await sleep(1000);
		return "hello promise";
	})(),
};

const stringified = stringifySync(source, {
	space: 2,
});
for await (const chunk of stringified) {
	console.log(chunk);
}
```

#### Promise example output

<!-- prettier-ignore-start -->
<!-- eslint-disable -->

```jsonc
{
	"json": {
		"foo": "bar",
		"promise": {
			"_": "$", // informs the deserializer that this is a special type
			"type": "Promise", // it is a Promise
			"value": 1, // index of the Promise that will come later
		},
	},
}
```

```jsonc
[
	1, // index of the Promise
	0, // Promise succeeded (0 = success, 1 = failure)
	{
		"json": "hello promise"
	}
]
```

### Streaming `AsyncIterable`s

#### AsyncIterable example input

```ts
const source = {
	asyncIterable: (async function* () {
		yield "hello";
		yield "world";

		return "done";
	})(),
};

const stringified = stringifySync(source, {
	space: 2,
});
for await (const chunk of stringified) {
	console.log(chunk);
}
```

#### AsyncIterable example output

```jsonc
{
	"json": {
		"foo": "bar",
		"asyncIterable": {
			"_": "$",
			"type": "AsyncIterable",
			"value": 0
		}
	}
}
```

```jsonc
[
	0,
	0,
	{
		"json": "world"
	}
]
```

```jsonc
[
	0, // index of the AsyncIterable
	2,
	{
		"json": "done"
	}
]
```

<!-- eslint-enable -->
<!-- prettier-ignore-end -->

## API Reference

### `stringifySync(value: unknown, options?: StringifyOptions): string`

Serializes a value into a JSON string.

### `parseSync<T>(value: string, options?: ParseOptions): T`

Deserializes a JSON string into a value.

### `stringifyAsync(value: unknown, options?: StringifyOptions): AsyncIterable<string, void>`

Async version of `stringifySync`.

#### `parseAsync<T>(value: string | AsyncIterable<string>, options?: ParseOptions): Promise<T>`

Async version of `parseSync`.

#### `serializeSync(value: unknown, options?: StringifyOptions): SerializeReturn`

Serializes a value into a `JSON.stringify`-compatible format.

#### `deserializeSync<T>(value: AsyncIterable<unknown>, options?: ParseOptions): Promise<T>`

Low-level function that deserializes from an intermediate format.

This is used internally by `parseSync` but can be useful for custom deserialization pipelines.

```ts
const deserialized = await deserializeSync(serialized, {
	deserializers,
});
```

#### `serializeAsync(value: unknown, options?: StringifyOptions): AsyncIterable<unknown>`

Async version of `serializeSync`.

Use this when you need to handle async values in your custom serialization pipeline.

```ts
const serialized = serializeAsync(value, {
	serializers,
});
for await (const chunk of serialized) {
	// Process intermediate format asynchronously
}
```

#### `deserializeAsync<T>(value: AsyncIterable<unknown>, options?: ParseOptions): Promise<T>`

Async version of `deserializeSync`.

Use this when you need to handle async values in your custom deserialization pipeline.

```ts
const deserialized = await deserializeAsync(serialized, {
	deserializers,
});
```

### Using Built-in Serializers

The `std` module provides built-in serializers for common JavaScript types.

```ts
import { parseSync, std, stringifySync } from "danson";

// Using built-in serializers
const data = {
	date: new Date(),
	map: new Map([["key", "value"]]),
	set: new Set([1, 2, 3]),
	url: new URL("https://example.com"),
};

const stringified = stringifySync(data, {
	serializers: {
		...std.serializers,
		// ... your custom serializers
	},
	space: 2,
});

const parsed = parseSync(stringified, {
	deserializers: {
		...std.deserializers,
		// ... your custom deserializers
	},
});
```

### Custom Serialization

You can provide custom serializers for your own types.

```ts
import { std } from "danson";
const stringified = stringifySync(value, {
	serializers: {
		...std.serializers, // use the built-in serializers (optional)
		MyCustomType: (value) => {
			if (value instanceof MyCustomType) {
				return value.toJSON();
			}
			return false;
		},
	},
});

const parsed = parseSync(stringified, {
	deserializers: {
		...std.deserializers, // use the built-in deserializers (optional)
		MyCustomType: (value) => new MyCustomType(value),
	},
});
```

#### `TransformerPair<TOriginal, TSerialized>`

Type utility for defining serializer/deserializer pairs.

Used internally but can be useful for type-safe custom serializers.

```ts
import { Temporal } from "@js-temporal/polyfill";
import { TransformerPair } from "danson";

// Define a type-safe transformer pair for Temporal.Instant
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

// Use the transformer pair
const source = {
	instant: Temporal.Now.instant(),
};

const stringified = stringifySync(source, {
	serializers: {
		"Temporal.Instant": serializeTemporalNow,
	},
});

const result = parseSync(stringified, {
	deserializers: {
		"Temporal.Instant": deserializeTemporalNow,
	},
});
```

## Contributors

<!-- You can remove this notice if you don't want it 🙂 no worries! -->

> 💝 This package was templated with [`create-typescript-app`](https://github.com/JoshuaKGoldberg/create-typescript-app) using the [Bingo framework](https://create.bingo).
