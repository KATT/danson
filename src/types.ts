export interface ParseOptions {
	revivers?: Record<string, (value: unknown) => unknown>;
}

export interface StringifyOptions {
	coerceError?: (cause: unknown) => unknown;
	reducers?: Record<string, (value: unknown) => unknown>;
}
