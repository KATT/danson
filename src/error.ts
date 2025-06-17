export class DansonError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "DansonError";
	}
}
