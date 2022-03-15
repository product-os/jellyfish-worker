import { Jellyscript } from '@balena/jellyfish-jellyscript';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import type { LinkConstraint } from '@balena/jellyfish-client-sdk';
import type { Dictionary } from 'lodash';
import type { TriggeredActionContract } from './types';
import { reverseLink } from './link-traversal';

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

// TS-TODO: use TypeContract interface instead of Contract
export const getTypeTriggers = (typeCard: TypeContract) => {
	// TS-TODO: use TriggeredActionDefinition interface instead of ContractDefinition
	const triggers: PartialTriggeredActionContract[] = [];

	// We create empty updates to cards that reference other cards in links
	// whenever those linked cards change.
	// This forces a reevaluation of formulas in the referencing card.
	const linkVerbs = getReferencedLinkVerbs(typeCard as TypeContract);
	triggers.push(
		...linkVerbs.flatMap((lv) =>
			createLinkTrigger(reverseLink(typeCard.slug, lv), typeCard),
		),
	);

	return triggers;
};

/**
 * Creates a triggered action that fires when a card gets changed that is linked
 * with the given link verb to a card of the given type
 *
 * @param linkVerb the verb that should trigger
 * @param typeCard the type containing the formula that needs the trigger
 * @returns the triggered action
 */
const createLinkTrigger = (
	linkGroups: Dictionary<LinkConstraint[]>,
	typeCard: TypeContract,
): PartialTriggeredActionContract[] => {
	if (Object.keys(linkGroups).length === 0) {
		return [];
	}
	return Object.entries(linkGroups)
		.filter(([, links]) => links.length)
		.map(([linkVerb, links]) => {
			// We try to optimize query speed by limiting to valid types or,
			// if all are allowed, by excluding some high frequency internal cards
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
					`triggered-action-formula-update-${typeCard.slug}-${linkVerb}`,
				),
				type: 'triggered-action@1.0.0',
				version: typeCard.version,
				active: true,
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
					action: 'action-update-card@1.0.0',
					type: `${typeCard.slug}@${typeCard.version}`,
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
										const: `${typeCard.slug}@${typeCard.version}`,
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
