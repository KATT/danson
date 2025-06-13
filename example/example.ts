import { stringifyAsync } from "danson";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const obj = {
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
};

const st = stringifyAsync(obj);

for await (const chunk of st) {
	console.dir(JSON.parse(chunk), { depth: null });
}
