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
json: {
	instant: {
	_: '$',
	type: 'Temporal.Instant',
	value: '2025-06-13T15:24:51.30029128Z'
	}
}
*/

const result = parseSync<typeof source>(stringified, {
	deserializers: {
		"Temporal.Instant": (value) => Temporal.Instant.from(value as string),
	},
});
```

### Streaming

#### Input

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

#### Output

<!-- prettier-ignore-start -->
<!-- eslint-disable -->

```jsonc
{
	"json": {
		"foo": "bar",
		"promise": { 
			"_": "$", // informs the deserializer that this is a special type
			"type": "Promise", // it is a Promise
			"value": 1 // index of the Promise that will come later
		}
	}
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

<!-- prettier-ignore-end -->
<!-- eslint-enable -->

## Installation

```shell
npm install danson
```

## Usage

## Contributors

<!-- You can remove this notice if you don't want it 🙂 no worries! -->

> 💝 This package was templated with [`create-typescript-app`](https://github.com/JoshuaKGoldberg/create-typescript-app) using the [Bingo framework](https://create.bingo).
