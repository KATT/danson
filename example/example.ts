import {
	parseAsync,
	parseSync,
	std,
	stringifyAsync,
	stringifySync,
} from "danson";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const source = () => ({
	iterator: (async function* () {
		await sleep(5000);
		yield "hello, i am an iterator";
		await sleep(500);
		return "i can return stuff too";
	})(),
	normalObject: {
		foo: "bar",
	},
	promise: (async () => {
		await sleep(1000);
		return "hello promise";
	})(),
});

async function main() {
	{
		console.log("Stringifying and parsing the object...");
		const iterator = stringifyAsync(source(), {
			serializers: std.serializers,
		});

		const obj = await parseAsync(iterator, {
			deserializers: std.deserializers,
		});

		console.log("Recreated object:", obj);
	}
	{
		console.log("\n\nShowing what stringifyAsync returns...");
		// Showing what stringifyAsync returns
		const iterator = stringifyAsync(source(), {
			serializers: std.serializers,
		});

		for await (const chunk of iterator) {
			console.dir(JSON.parse(chunk), { depth: null });
		}
	}

	{
		console.log("\n\nShowing a self-referencing object:");

		const selfReferencingObject: Record<string, unknown> = {
			description: "This is a self-referencing object",
		};
		selfReferencingObject.self = selfReferencingObject;
		const obj = {
			selfReferencingObject,
		};
		const stringified = stringifySync(obj, {
			serializers: std.serializers,
		});
		console.dir(JSON.parse(stringified), { depth: null });

		const parsed = parseSync(stringified, {
			deserializers: std.deserializers,
		});

		console.log("Parsed:");
		console.dir(parsed);
	}
}

main().catch(console.error);
