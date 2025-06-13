import { parseAsync, stringifyAsync } from "danson";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const source = () => ({
	iterator: (async function* () {
		await wait(5000);
		yield "hello, i am an iterator";
		await wait(500);
		return "i can return stuff too";
	})(),
	normalObject: {
		foo: "bar",
	},
	promise: (async () => {
		await wait(1000);
		return "hello promise";
	})(),
});
type Source = ReturnType<typeof source>;

// Reconstructing the object
{
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
