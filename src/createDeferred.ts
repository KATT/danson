export function createDeferred<TValue = void>() {
	let resolve: (value: TValue) => void;
	let reject: (error: unknown) => void;
	const promise = new Promise<TValue>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return { promise, reject: reject!, resolve: resolve! };
}
