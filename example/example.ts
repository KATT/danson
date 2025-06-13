import { parseAsync, stringifyAsync } from "danson";

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
type Source = ReturnType<typeof source>;

async function main() {
	{
		console.log("Stringifying and parsing the object...");
		const iterator = stringifyAsync(source());

		const obj = await parseAsync<Source>(iterator);

		console.log("Recreated object:", obj);
	}
	{
		console.log("Showing what stringifyAsync returns...");
		// Showing what stringifyAsync returns
		const iterator = stringifyAsync(source());

		for await (const chunk of iterator) {
			console.dir(JSON.parse(chunk), { depth: null });
		}
	}
}

main().catch(console.error);
