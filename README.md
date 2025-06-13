<h1 align="center">DanSON</h1>

<p align="center">Progressive JSON</p>

<p align="center">
	<a href="https://github.com/KATT/danson/blob/main/.github/CODE_OF_CONDUCT.md" target="_blank"><img alt="🤝 Code of Conduct: Kept" src="https://img.shields.io/badge/%F0%9F%A4%9D_code_of_conduct-kept-21bb42" /></a>
	<a href="https://codecov.io/gh/KATT/danson" target="_blank"><img alt="🧪 Coverage" src="https://img.shields.io/codecov/c/github/KATT/danson?label=%F0%9F%A7%AA%20coverage" /></a>
	<a href="https://github.com/KATT/danson/blob/main/LICENSE.md" target="_blank"><img alt="📝 License: MIT" src="https://img.shields.io/badge/%F0%9F%93%9D_license-MIT-21bb42.svg" /></a>
	<a href="http://npmjs.com/package/danson" target="_blank"><img alt="📦 npm version" src="https://img.shields.io/npm/v/danson?color=21bb42&label=%F0%9F%93%A6%20npm" /></a>
	<img alt="💪 TypeScript: Strict" src="https://img.shields.io/badge/%F0%9F%92%AA_typescript-strict-21bb42.svg" />
</p>

## About

Example: https://stackblitz.com/github/KATT/danson/tree/main/example

### Example

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

```json
{
	"json": {
		"foo": "bar",
		"promise": {
			"_": "$",
			"type": "Promise", // <-- holds the reference to the promise
			"value": 1
		}
	}
}
```

```json
[
	1, // <-- index of the promise
	0, // <-- promise succeeded
	{
		"json": "hello promise"
	}
]
```

## Installation

```shell
npm install danson
```

## Usage

## Contributors

<!-- You can remove this notice if you don't want it 🙂 no worries! -->

> 💝 This package was templated with [`create-typescript-app`](https://github.com/JoshuaKGoldberg/create-typescript-app) using the [Bingo framework](https://create.bingo).
