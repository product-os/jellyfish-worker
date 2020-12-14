/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

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
