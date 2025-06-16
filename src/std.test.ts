import { describe, expect, it } from "vitest";

import { deserializers, serializers } from "./std.js";
import { deserializeSync, SerializeReturn, serializeSync } from "./sync.js";

const serialize = (value: unknown) => {
	return serializeSync(value, {
		serializers,
	});
};

const deserialize = <T>(value: SerializeReturn) => {
	return deserializeSync<T>({
		...value,
		deserializers,
	});
};

describe("BigInt", () => {
	it("serializes and deserializes BigInt", () => {
		const value = BigInt(123);
		const serialized = serializers.BigInt(value);
		expect(serialized).toBe("123");
		if (typeof serialized === "string") {
			const deserialized = deserializers.BigInt(serialized);
			expect(deserialized).toBe(value);
		}
	});

	it("returns false for non-BigInt values", () => {
		expect(serializers.BigInt(123)).toBe(false);
		expect(serializers.BigInt("123")).toBe(false);
	});
});

describe("Date", () => {
	it("serializes and deserializes Date", () => {
		const value = new Date("2024-01-01T00:00:00.000Z");
		const serialized = serializers.Date(value);
		expect(serialized).toBe("2024-01-01T00:00:00.000Z");
		if (typeof serialized === "string") {
			const deserialized = deserializers.Date(serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-Date values", () => {
		expect(serializers.Date("2024-01-01")).toBe(false);
		expect(serializers.Date(123)).toBe(false);
	});
});

describe("Map", () => {
	it("serializes and deserializes Map", () => {
		const value = new Map([
			["a", 1],
			["b", 2],
		]);
		const serialized = serializers.Map(value);
		expect(serialized).toEqual([
			["a", 1],
			["b", 2],
		]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.Map.create();
			deserializers.Map.set(deserialized, serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-Map values", () => {
		expect(serializers.Map({ a: 1, b: 2 })).toBe(false);
		expect(serializers.Map([])).toBe(false);
	});
});

describe("RegExp", () => {
	it("serializes and deserializes RegExp", () => {
		const value = /test/i;
		const serialized = serializers.RegExp(value);
		expect(serialized).toEqual(["test", "i"]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.RegExp(serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-RegExp values", () => {
		expect(serializers.RegExp("test")).toBe(false);
		expect(serializers.RegExp({ flags: "i", source: "test" })).toBe(false);
	});
});

describe("Set", () => {
	it("serializes and deserializes Set", () => {
		const value = new Set([1, 2, 3]);
		const serialized = serializers.Set(value);
		expect(serialized).toEqual([1, 2, 3]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.Set.create();
			deserializers.Set.set(deserialized, serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-Set values", () => {
		expect(serializers.Set([1, 2, 3])).toBe(false);
		expect(serializers.Set({ size: 3 })).toBe(false);
	});
});

describe("URL", () => {
	it("serializes and deserializes URL", () => {
		const value = new URL("https://example.com");
		const serialized = serializers.URL(value);
		expect(serialized).toBe("https://example.com/");
		if (typeof serialized === "string") {
			const deserialized = deserializers.URL(serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-URL values", () => {
		expect(serializers.URL("https://example.com")).toBe(false);
		expect(serializers.URL({ href: "https://example.com" })).toBe(false);
	});
});

describe("URLSearchParams", () => {
	it("serializes and deserializes URLSearchParams", () => {
		const value = new URLSearchParams("a=1&b=2");
		const serialized = serializers.URLSearchParams(value);
		expect(serialized).toBe("a=1&b=2");
		if (typeof serialized === "string") {
			const deserialized = deserializers.URLSearchParams(serialized);
			expect(deserialized).toEqual(value);
		}
	});

	it("returns false for non-URLSearchParams values", () => {
		expect(serializers.URLSearchParams("a=1&b=2")).toBe(false);
		expect(serializers.URLSearchParams({ toString: () => "a=1&b=2" })).toBe(
			false,
		);
	});
});

describe("FormData", () => {
	it("serializes and deserializes FormData with string values", () => {
		const value = new FormData();
		value.append("a", "1");
		value.append("b", "2");
		const serialized = serializers.FormData(value);
		expect(serialized).toEqual([
			["a", "1"],
			["b", "2"],
		]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.FormData.create();
			deserializers.FormData.set(deserialized, serialized);
			expect(deserialized.get("a")).toBe("1");
			expect(deserialized.get("b")).toBe("2");
		}
	});

	it("serializes and deserializes FormData with File values", () => {
		const value = new FormData();
		const file = new File([], "test.txt", { type: "text/plain" });
		value.append("file", file);
		const serialized = serializers.FormData(value);
		expect(serialized).toEqual([
			[
				"file",
				{
					name: "test.txt",
					size: 0,
					type: "text/plain",
				},
			],
		]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.FormData.create();
			deserializers.FormData.set(deserialized, serialized);
			const deserializedFile = deserialized.get("file") as File;
			expect(deserializedFile).toBeInstanceOf(File);
			expect(deserializedFile.name).toBe("test.txt");
			expect(deserializedFile.type).toBe("text/plain");
		}
	});

	it("returns false for non-FormData values", () => {
		expect(
			serializers.FormData({
				append: () => {
					//
				},
			}),
		).toBe(false);
		expect(serializers.FormData([])).toBe(false);
	});
});

describe("Blob", () => {
	it("serializes and deserializes Blob", () => {
		const value = new Blob(["test"], { type: "text/plain" });
		const serialized = serializers.Blob(value);
		expect(serialized).toEqual({
			size: 4,
			type: "text/plain",
		});
		if (serialized && typeof serialized === "object") {
			const deserialized = deserializers.Blob(serialized);
			expect(deserialized).toBeInstanceOf(Blob);
			expect(deserialized.type).toBe("text/plain");
			expect(deserialized.size).toBe(0); // Note: size is 0 because we create an empty Blob
		}
	});

	it("returns false for non-Blob values", () => {
		expect(serializers.Blob({ type: "text/plain" })).toBe(false);
		expect(serializers.Blob("test")).toBe(false);
	});
});

describe("File", () => {
	it("serializes and deserializes File", () => {
		const value = new File(["test"], "test.txt", { type: "text/plain" });
		const serialized = serializers.File(value);
		expect(serialized).toEqual({
			name: "test.txt",
			size: 4,
			type: "text/plain",
		});
		if (serialized && typeof serialized === "object") {
			const deserialized = deserializers.File(serialized);
			expect(deserialized).toBeInstanceOf(File);
			expect(deserialized.name).toBe("test.txt");
			expect(deserialized.type).toBe("text/plain");
			expect(deserialized.size).toBe(0); // Note: size is 0 because we create an empty File
		}
	});

	it("returns false for non-File values", () => {
		expect(serializers.File({ name: "test.txt" })).toBe(false);
		expect(serializers.File("test.txt")).toBe(false);
	});
});

describe("Headers", () => {
	it("serializes and deserializes Headers", () => {
		const value = new Headers();
		value.append("a", "1");
		value.append("b", "2");
		const serialized = serializers.Headers(value);
		expect(serialized).toEqual([
			["a", "1"],
			["b", "2"],
		]);
		if (Array.isArray(serialized)) {
			const deserialized = deserializers.Headers.create();
			deserializers.Headers.set(deserialized, serialized);
			expect(deserialized.get("a")).toBe("1");
			expect(deserialized.get("b")).toBe("2");
		}
	});

	it("returns false for non-Headers values", () => {
		expect(
			serializers.Headers({
				append: () => {
					//
				},
			}),
		).toBe(false);
		expect(serializers.Headers([])).toBe(false);
	});
});

describe("TypedArray", () => {
	it("serializes and deserializes Int8Array", () => {
		const value = new Int8Array([1, 2, 3]);
		const serialized = serializers.TypedArray(value);
		expect(serialized).toEqual({
			data: [1, 2, 3],
			type: "Int8Array",
		});
		if (serialized && typeof serialized === "object") {
			const deserialized = deserializers.TypedArray(serialized);
			expect(deserialized).toBeInstanceOf(Int8Array);
			expect(Array.from(deserialized as Int8Array)).toEqual([1, 2, 3]);
		}
	});

	it("serializes and deserializes BigInt64Array", () => {
		const value = new BigInt64Array([BigInt(1), BigInt(2), BigInt(3)]);
		const serialized = serializers.TypedArray(value);
		expect(serialized).toEqual({
			data: [BigInt(1), BigInt(2), BigInt(3)],
			type: "BigInt64Array",
		});
		if (serialized && typeof serialized === "object") {
			const deserialized = deserializers.TypedArray(serialized);
			expect(deserialized).toBeInstanceOf(BigInt64Array);
			expect(Array.from(deserialized as BigInt64Array)).toEqual([
				BigInt(1),
				BigInt(2),
				BigInt(3),
			]);
		}
	});

	it("returns false for non-TypedArray values", () => {
		expect(serializers.TypedArray([1, 2, 3])).toBe(false);
		expect(serializers.TypedArray({ length: 3 })).toBe(false);
	});
});

describe("undefined", () => {
	it("serializes and deserializes undefined", () => {
		const value = undefined;
		const serialized = serializers.undefined(value);
		expect(serialized).toBe(undefined);
		if (serialized === undefined) {
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
			const deserialized = deserializers.undefined(serialized);
			expect(deserialized).toBe(undefined);
		}
	});

	it("returns false for non-undefined values", () => {
		expect(serializers.undefined(null)).toBe(false);
		expect(serializers.undefined("")).toBe(false);
	});
});
