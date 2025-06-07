import { expect, test } from "vitest";

import { parseSync, stringifySync } from "./sync.js";
import { reducers, revivers } from "./test.helpers.js";

test("map with circular key", () => {
	const source = { map: new Map() };
	source.map.set(source.map, 1);

	const str = stringifySync(source, { reducers });
	const result = parseSync<typeof source>(str, { revivers });

	expect(result).toEqual(source);
});

test("map with circular value", () => {
	const source = new Map();
	source.set("self", source);

	const str = stringifySync(source, { reducers });
	const result = parseSync<typeof source>(str, { revivers });

	expect(result).toEqual(source);
});

test("map with circular key and value", () => {
	const map = new Map();
	map.set(map, map);
	const source = { map };

	const str = stringifySync(source, { reducers });
	const result = parseSync<typeof source>(str, { revivers });

	expect(result).toEqual(source);
});

test("set with circular references", () => {
	const obj1: any = { id: 1 };
	obj1.self = obj1;
	const obj2: any = { id: 2 };
	obj2.self = obj2;

	const set = new Set();
	set.add(set);
	set.add({
		set,
	});
	const source = { set };

	const str = stringifySync(source, { reducers });
	const result = parseSync<typeof source>(str, { revivers });

	expect(result).toEqual(source);
});

test("map in a deep object", () => {
	const source = { map: new Map() };
	source.map.set("self", {
		map: source.map,
	});

	const str = stringifySync(source, { reducers });
	const result = parseSync<typeof source>(str, { revivers });

	expect(result).toEqual(source);
});
