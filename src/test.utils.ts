import http from "node:http";
import { AddressInfo } from "node:net";
import { expect } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T extends object = object> = new (...args: any[]) => T;

export async function aggregateAsyncIterable<TYield, TReturn>(
	iterable: AsyncIterable<TYield, TReturn>,
) {
	const items: TYield[] = [];

	try {
		const iterator = iterable[Symbol.asyncIterator]();
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		while (true) {
			const res = await iterator.next();
			if (res.done) {
				return {
					items,
					ok: true as const,
					return: res.value,
				};
			}
			items.push(res.value);
		}
	} catch (error: unknown) {
		return {
			error,
			items,
			ok: false as const,
		};
	}
}

export async function waitError<TError extends Error = Error>(
	fnOrPromise: (() => unknown) | Promise<unknown>,
	errorConstructor?: Constructor<TError>,
): Promise<TError> {
	try {
		if (typeof fnOrPromise === "function") {
			await fnOrPromise();
		} else {
			await fnOrPromise;
		}
	} catch (cause) {
		expect(cause).toBeInstanceOf(errorConstructor ?? Error);
		return cause as TError;
	}
	throw new Error("Function did not throw");
}

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export function serverResource(
	handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
) {
	const server = http.createServer(handler);
	server.listen(0);
	const port = (server.address() as AddressInfo).port;

	const url = `http://localhost:${String(port)}`;

	return {
		[Symbol.dispose]() {
			server.close();
		},
		url,
	};
}

export async function* withDebug<T>(iterable: AsyncIterable<T>) {
	for await (const item of iterable) {
		console.log("item", item);
		yield item;
	}
}
