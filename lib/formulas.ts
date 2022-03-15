import { Jellyscript } from '@balena/jellyfish-jellyscript';
import type { TypeContract } from '@balena/jellyfish-types/build/core';

enum NEEDS_STATUS {
	PENDING = 'pending',
	MERGEABLE = 'mergeable',
	NEVER = 'never',
}

export const NEEDS_ALL = (...statuses: NEEDS_STATUS[]) => {
	let result = NEEDS_STATUS.MERGEABLE;

	for (const status of statuses) {
		if (status === NEEDS_STATUS.NEVER) {
			result = NEEDS_STATUS.NEVER;
			break;
		}

		if (status === NEEDS_STATUS.PENDING) {
			result = NEEDS_STATUS.PENDING;
		}
	}

	return result;
};

/**
 * Looks at a contract and checks whether there is a backflow that meets the type and
 * filter callback (optional). If no, it means a transformer is still running and status
 * is pending. If yes, then if there is an error for the expected type, it concludes
 * it is never mergeable, otherwise if no error exists it is mergeable.
 *
 * @param contract Contract to look for a backflow
 * @param type The expexted output type of the backflow
 * @param func A filter function to match the backflow contract
 * @returns NEEDS_STATUS status
 */
export const NEEDS = (
	contract: any,
	type: string,
	func: (contract: any) => boolean = () => true,
) => {
	const backflowHasError = contract.data.$transformer.backflow.some((c) => {
		return (
			c.type.split('@')[0] === 'error' &&
			c.data.expectedOutputTypes.includes(type) &&
			func(c)
		);
	});
	if (backflowHasError) {
		return NEEDS_STATUS.NEVER;
	}

	const backflowisMergeable = contract.data.$transformer.backflow.some(
		(c) =>
			c.type.split('@')[0] === type &&
			func(c) &&
			[NEEDS_STATUS.MERGEABLE, true].includes(c.data.$transformer.mergeable),
	);
	if (backflowisMergeable) {
		return NEEDS_STATUS.MERGEABLE;
	}

	return NEEDS_STATUS.PENDING;
};

export const getReferencedLinkVerbs = (typeCard: TypeContract): string[] => {
	const linkVerbs = Jellyscript.getObjectMemberExpressions(
		typeCard.data.schema,
		'contract',
		'links',
	);
	return linkVerbs;
};
