import { expect, test } from "vitest";

import { deserializers, serializers } from "./std.js";
import {
	deserializeSync,
	parseSync,
	serializeSync,
	stringifySync,
} from "./sync.js";

test("circular object", () => {
	const source: any = { a: 1 };
	source.b = source;

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

	expect(result).toEqual(source);
});

test("map with circular key", () => {
	const source = { map: new Map() };
	source.map.set(source.map, 1);

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

	expect(result).toEqual(source);
});

test("map with circular value", () => {
	const source = new Map();
	source.set("self", source);

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

	expect(result).toEqual(source);
});

test("map with circular key and value", () => {
	const map = new Map();
	map.set(map, map);
	const source = { map };

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

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

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

	expect(result).toEqual(source);
});

test("map in a deep object", () => {
	const source = { map: new Map() };
	source.map.set("self", {
		map: source.map,
	});

	const str = stringifySync(source, { serializers });
	const result = parseSync<typeof source>(str, { deserializers });

	expect(result).toEqual(source);
});

test("custom type with recursive references", async () => {
	class Node {
		constructor(
			public id: string,
			public edges: Node[],
		) {}
	}

	const node1 = new Node("1", []);
	const node2 = new Node("2", [node1]);
	const node3 = new Node("3", [node2]);
	node1.edges.push(node3);

	const source = () => ({
		graph: {
			node: node1,
		},
	});
	type Source = ReturnType<typeof source>;

	const serialized = serializeSync(source(), {
		serializers: {
			Node: (value) =>
				value instanceof Node && {
					edges: value.edges,
					id: value.id,
				},
		},
	});

	const result = deserializeSync<Source>(serialized, {
		deserializers: {
			Node: {
				create: () => new Node("", []),
				set: (node, value) => {
					const raw = value as { edges: Node[]; id: string };
					(node as Node).id = raw.id;
					(node as Node).edges = raw.edges;
				},
			},
		},
	});

	expect(result).toEqual(source());
});
