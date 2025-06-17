import { expect, test } from "vitest";

import { deserializeSync, serializeSync } from "./index.js";

test("smoke test", () => {
	const value = {
		bar: 1,
		foo: "bar",
	};
	const serialized = serializeSync(value);
	const deserialized = deserializeSync(serialized);
	expect(deserialized).toEqual(value);
});
