import type { LinkConstraint } from '@balena/jellyfish-client-sdk';
import { Jellyscript } from '@balena/jellyfish-jellyscript';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import type { Dictionary } from 'lodash';
import { reverseLink } from './link-traversal';
import type { TriggeredActionContract } from './types';

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
 * @param contract - Contract to look for a backflow
 * @param type - The expexted output type of the backflow
 * @param func - A filter function to match the backflow contract
 * @returns NEEDS_STATUS status
 */
export const NEEDS = (
	contract: any,
	type: string,
	func: (contract: any) => boolean = () => true,
) => {
	// TS-TODO: Use proper contract type
	const backflowHasError = contract.data.$transformer.backflow.some(
		(backflowContract: Contract) => {
			return (
				backflowContract.type.split('@')[0] === 'error' &&
				(backflowContract.data as any).expectedOutputTypes.includes(type) &&
				func(backflowContract)
			);
		},
	);
	if (backflowHasError) {
		return NEEDS_STATUS.NEVER;
	}

	// TS-TODO: Use proper contract type
	const backflowisMergeable = contract.data.$transformer.backflow.some(
		(backflowContract: Contract) =>
			backflowContract.type.split('@')[0] === type &&
			func(backflowContract) &&
			[NEEDS_STATUS.MERGEABLE, true].includes(
				(backflowContract.data as any).$transformer.mergeable,
			),
	);
	if (backflowisMergeable) {
		return NEEDS_STATUS.MERGEABLE;
	}

	return NEEDS_STATUS.PENDING;
};

export const getReferencedLinkVerbs = (
	typeContract: TypeContract,
): string[] => {
	const linkVerbs = Jellyscript.getObjectMemberExpressions(
		typeContract.data.schema,
		'contract',
		'links',
	);
	return linkVerbs;
};

const slugify = (str: string): string => {
	return str
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-{1,}/g, '-');
};

type PartialTriggeredActionContract = Omit<
	TriggeredActionContract,
	'id' | 'created_at' | 'updated_at'
>;

export const getTypeTriggers = (typeContract: TypeContract) => {
	const triggers: PartialTriggeredActionContract[] = [];

	// We create empty updates to contracts that reference other contracts in links
	// whenever those linked contracts change.
	// This forces a reevaluation of formulas in the referencing contract.
	const linkVerbs = getReferencedLinkVerbs(typeContract as TypeContract);
	triggers.push(
		...linkVerbs.flatMap((lv) =>
			createLinkTrigger(reverseLink(typeContract.slug, lv), typeContract),
		),
	);

	return triggers;
};

/**
 * Creates a triggered action that fires when a contract gets changed that is linked
 * with the given link verb to a contract of the given type
 *
 * @param linkGroups - link groups
 * @param typeContract - the type containing the formula that needs the trigger
 * @returns the triggered action
 */
const createLinkTrigger = (
	linkGroups: Dictionary<LinkConstraint[]>,
	typeContract: TypeContract,
): PartialTriggeredActionContract[] => {
	if (Object.keys(linkGroups).length === 0) {
		return [];
	}
	return Object.entries(linkGroups)
		.filter(([, links]) => links.length)
		.map(([linkVerb, links]) => {
			// We try to optimize query speed by limiting to valid types or,
			// if all are allowed, by excluding some high frequency internal contracts
			const typeFilter =
				links.filter((l) => l.data.from === '*').length === 0
					? {
							enum: links.map((t) => `${t.data.from}@1.0.0`),
					  }
					: {
							not: {
								enum: ['create@1.0.0', 'update@1.0.0', 'link@1.0.0'],
							},
					  };
			return {
				slug: slugify(
					`triggered-action-formula-update-${typeContract.slug}-${linkVerb}`,
				),
				type: 'triggered-action@1.0.0',
				version: typeContract.version,
				active: true,
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
					action: 'action-update-card@1.0.0',
					type: `${typeContract.slug}@${typeContract.version}`,
					target: {
						$map: {
							$eval: `source.links['${linkVerb}']`, // there was a [0:] at the end... :-/
						},
						'each(card)': {
							$eval: 'card.id',
						},
					},
					arguments: {
						reason: 'formula re-evaluation',
						patch: [],
					},
					filter: {
						type: 'object',
						required: ['type', 'data'],
						$$links: {
							[linkVerb]: {
								type: 'object',
								required: ['type'],
								properties: {
									type: {
										type: 'string',
										const: `${typeContract.slug}@${typeContract.version}`,
									},
								},
							},
						},
						properties: {
							type: {
								type: 'string',
								...typeFilter,
							},
							updated_at: true,
						},
					},
				},
			};
		});
};
