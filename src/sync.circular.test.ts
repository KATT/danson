/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect, test } from "vitest";

import { deserializeSync, serializeSync } from "./sync.js";
import { reducers, revivers } from "./test.helpers.js";

test("map with circular key", () => {
	const map = new Map<any, any>();
	map.set(map, map);
	const source = { map };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
});

test("map with circular value", () => {
	const map = new Map();
	map.set("self", map);

	const source = map;

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
});

test("map with circular key and value", () => {
	const map = new Map();
	map.set(map, map);
	const source = { map };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
});

test("set with circular references", () => {
	const obj1: any = { id: 1 };
	obj1.self = obj1;
	const obj2: any = { id: 2 };
	obj2.self = obj2;

	const set = new Set(["first", "last", "middle", obj1, obj1, obj2]);
	const source = { set };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
	const circularItems = Array.from(result.set).filter(
		(item) => typeof item === "object" && item !== null && "self" in item,
	);
	expect(circularItems).toHaveLength(2);
	circularItems.forEach((item) => {
		expect(item.self).toBe(item);
	});
});

test("nested circular references", () => {
	const parent = { children: [] as any[], name: "parent" };
	const child = { name: "child", parent };
	parent.children.push(child);

	const map = new Map([[parent, "parent-value"]]);
	const source = { map, parent };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
	expect(result.parent.children[0].parent).toBe(result.parent);
	expect(result.map.has(result.parent)).toBe(true);
});

test("complex bidirectional relationships", () => {
	const user = { groups: new Set(), name: "Alice" };
	const group = { name: "Admins", users: new Set([user]) };
	user.groups.add(group);

	const source = { group, user };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
	expect(result.user.groups.has(result.group)).toBe(true);
	expect(result.group.users.has(result.user)).toBe(true);
});

test("map as key and value", () => {
	const selfMap = new Map([["id", "self-map"]]);
	const container = new Map<any, any>([
		["normal", "value"],
		[selfMap, selfMap],
	]);
	const source = { container };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
	const entry = Array.from(result.container.entries()).find(
		([k]) => k instanceof Map,
	);
	expect(entry).toBeDefined();
	const [key, value] = entry!;
	expect(key).toBe(value);
});

test("custom types with circular references", () => {
	const container = {
		created: new Date("2023-01-01"),
		refs: [] as any[],
	};
	container.refs.push(container, container.created);
	const source = { container };

	const meta = serializeSync(source, { reducers });
	const result = deserializeSync<typeof source>({ ...meta, revivers });

	expect(result).toEqual(source);
	expect(result.container.refs[0]).toBe(result.container);
	expect(result.container.refs[1]).toBeInstanceOf(Date);
});
