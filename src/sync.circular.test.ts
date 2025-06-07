/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect, test } from "vitest";

import { deserializeSync, serializeSync } from "./sync.js";
import { reducers, revivers } from "./test.helpers.js";

test("map with circular key", () => {
	const circularKey = { name: "circular" };
	const map = new Map();
	map.set(circularKey, "value1");
	map.set("normal", "value2");
	map.set(circularKey, circularKey); // key points to itself as value

	const source = { map };

	const meta = serializeSync(source, { reducers });

	expect(meta).toMatchInlineSnapshot(`
		{
		  "json": {
		    "map": {
		      "_": "$",
		      "type": "Map",
		      "value": [
		        [
		          "$1",
		          "$1",
		        ],
		        [
		          "normal",
		          "value2",
		        ],
		      ],
		    },
		  },
		  "refs": {
		    "$1": {
		      "name": "circular",
		    },
		  },
		}
	`);

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
	expect(result.map.size).toBe(2);

	// Check that the circular key reference is preserved
	const keys = Array.from(result.map.keys());
	const circularKeyResult = keys.find(
		(k) => typeof k === "object" && k !== null,
	);
	expect(circularKeyResult).toBeDefined();
	expect(result.map.get(circularKeyResult)).toBe(circularKeyResult);
});

test("map with circular value", () => {
	const circularValue: any = { name: "circular" };
	circularValue.self = circularValue;

	const map = new Map();
	map.set("key1", circularValue);
	map.set("key2", "normal");
	map.set("key3", circularValue); // same circular value appears twice

	const source = { map };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
	expect(result.map.size).toBe(3);

	// Check that both references point to the same circular object
	const val1 = result.map.get("key1");
	const val3 = result.map.get("key3");
	expect(val1).toBe(val3);
	expect(val1.self).toBe(val1);
});

test("map with both circular key and value", () => {
	const circularObj: any = { name: "circular" };
	circularObj.self = circularObj;

	const map = new Map();
	map.set(circularObj, circularObj); // both key and value are the same circular object
	map.set("normal", "value");

	const source = { map };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
	expect(result.map.size).toBe(2);

	// Check that key and value are the same circular object
	const entries = Array.from(result.map.entries());
	const circularEntry = entries.find(
		([k, v]) => typeof k === "object" && k !== null,
	);
	expect(circularEntry).toBeDefined();

	const [key, value] = circularEntry!;
	expect(key).toBe(value);
	expect(key.self).toBe(key);
});

test("set with circular references and order preservation", () => {
	const circular1: any = { id: 1 };
	circular1.self = circular1;

	const circular2: any = { id: 2 };
	circular2.self = circular2;

	const set = new Set();
	set.add("first");
	set.add(circular1);
	set.add("middle");
	set.add(circular2);
	set.add(circular1); // duplicate circular reference
	set.add("last");

	const source = { set };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
	expect(result.set.size).toBe(5); // duplicates are removed in Sets

	// Check order preservation
	const originalArray = Array.from(source.set);
	const resultArray = Array.from(result.set);

	expect(resultArray).toHaveLength(originalArray.length);

	// Check that circular references are preserved
	const circularItems = resultArray.filter(
		(item) => typeof item === "object" && item !== null && "self" in item,
	);
	expect(circularItems).toHaveLength(2);

	for (const item of circularItems) {
		expect(item.self).toBe(item);
	}
});

test("nested circular references", () => {
	const parent = { children: [] as any[], name: "parent" };
	const child1 = { name: "child1", parent };
	const child2 = { name: "child2", parent };

	parent.children.push(child1, child2);

	// Add a map that references the parent
	const map = new Map();
	map.set(parent, "parent-value");
	map.set("child-count", parent.children.length);

	const source = { map, parent };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);

	// Verify circular references are preserved
	expect(result.parent.children[0].parent).toBe(result.parent);
	expect(result.parent.children[1].parent).toBe(result.parent);

	// Verify map references are preserved
	expect(result.map.has(result.parent)).toBe(true);
	expect(result.map.get(result.parent)).toBe("parent-value");
});

test("complex circular structure with multiple custom types", () => {
	const data = {
		groups: new Set(),
		metadata: { refs: [] as any[] },
		users: new Map(),
	};

	const user1 = { groups: new Set(), id: 1, name: "Alice" };
	const user2 = { groups: new Set(), id: 2, name: "Bob" };

	const group1 = { id: 1, name: "Admins", users: new Set([user1]) };
	const group2 = { id: 2, name: "Users", users: new Set([user1, user2]) };

	user1.groups.add(group1);
	user1.groups.add(group2);
	user2.groups.add(group2);

	data.users.set(user1.id, user1);
	data.users.set(user2.id, user2);
	data.groups.add(group1);
	data.groups.add(group2);
	data.metadata.refs.push(user1, group1, data);

	const source = { data };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);

	// Verify the complex circular relationships
	const resultUser1 = result.data.users.get(1);
	const resultUser2 = result.data.users.get(2);
	const resultGroups = Array.from(result.data.groups) as any[];
	const resultGroup1 = resultGroups.find((g: any) => g.name === "Admins");
	const resultGroup2 = resultGroups.find((g: any) => g.name === "Users");

	expect(resultUser1.groups.has(resultGroup1)).toBe(true);
	expect(resultUser1.groups.has(resultGroup2)).toBe(true);
	expect(resultUser2.groups.has(resultGroup2)).toBe(true);

	expect(resultGroup1.users.has(resultUser1)).toBe(true);
	expect(resultGroup2.users.has(resultUser1)).toBe(true);
	expect(resultGroup2.users.has(resultUser2)).toBe(true);

	// Verify metadata references
	expect(result.data.metadata.refs[0]).toBe(resultUser1);
	expect(result.data.metadata.refs[1]).toBe(resultGroup1);
	expect(result.data.metadata.refs[2]).toBe(result.data);
});

test("map using itself as both key and value", () => {
	const selfMap = new Map();
	const container = new Map();

	// Self map has some normal data
	selfMap.set("id", "self-map");
	selfMap.set("type", "container");

	// Container uses selfMap as both key and value
	container.set(selfMap, selfMap);
	container.set("normal", "value");

	const source = { container };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);

	// Find the entry where map is used as both key and value
	const entries = Array.from(result.container.entries());
	const circularEntry = entries.find(([k, v]) => k instanceof Map);
	expect(circularEntry).toBeDefined();

	const [mapKey, mapValue] = circularEntry!;
	expect(mapKey).toBe(mapValue);
	expect(mapKey.get("id")).toBe("self-map");
});

test("date objects with circular references", () => {
	const container = {
		created: new Date("2023-01-01"),
		modified: new Date("2023-02-01"),
		refs: [] as any[],
	};

	container.refs.push(container, container.created);

	const source = { container };

	const meta = serializeSync(source, { reducers });

	const result = deserializeSync<typeof source>({
		...meta,
		revivers,
	});

	expect(result).toEqual(source);
	expect(result.container.refs[0]).toBe(result.container);
	expect(result.container.refs[1]).toBe(result.container.created);
	expect(result.container.created).toBeInstanceOf(Date);
	expect(result.container.modified).toBeInstanceOf(Date);
});
