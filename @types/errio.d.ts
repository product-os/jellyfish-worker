// Type definitions for errio
// TS-TODO: Add an errio definition to the definitely typed project

declare module 'errio' {
	let toObject: (
		error: Error,
		options: {
			stack: boolean;
		},
	) => object;

	let fromObject: (data: any) => Error;
}
