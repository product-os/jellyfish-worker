import { Jellyscript } from '@balena/jellyfish-jellyscript';
import type { RelationshipContract, TypeContract } from 'autumndb';
import _, { Dictionary } from 'lodash';
import type { TriggeredActionContract } from './types';

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

/**
 * Returns reversed link verb names as defined by relationship contracts.
 *
 * @param relationships - available relationship contracts
 * @param versionedType - the type the link is starting from
 * @param name - the link verb to reverse
 * @returns a reverse link verbs
 */
export const reverseRelationship = (
	relationships: RelationshipContract[],
	versionedType: string,
	name: string,
): Dictionary<RelationshipContract[]> => {
	const [type] = versionedType.split('@');

	// Find matching relationship(s)
	const reversed: RelationshipContract[] = [];
	const matches: RelationshipContract[] = relationships.filter(
		(relationship) => {
			return (
				(relationship.name === name &&
					(relationship.data.from.type === type ||
						relationship.data.from.type === '*')) ||
				(relationship.data.inverseName === name &&
					(relationship.data.to.type === type ||
						relationship.data.to.type === '*'))
			);
		},
	);
	if (matches.length === 0) {
		return {};
	}

	// Ensure reverse of request parameters is returned
	for (const relationship of matches) {
		if (relationship.name === name) {
			const reverse = _.cloneDeep(relationship);
			reverse.name = relationship.data.inverseName;
			reverse.data.inverseName = relationship.name;
			reverse.data.from = relationship.data.to;
			reverse.data.to = relationship.data.from;
			reversed.push(reverse);
		} else {
			reversed.push(relationship);
		}
	}
	return _.groupBy(reversed, (relationship) => relationship.name);
};

export const getTypeTriggers = (
	relationships: RelationshipContract[],
	typeContract: TypeContract,
) => {
	const triggers: PartialTriggeredActionContract[] = [];

	// We create empty updates to contracts that reference other contracts in links
	// whenever those linked contracts change.
	// This forces a reevaluation of formulas in the referencing contract.
	const linkVerbs = getReferencedLinkVerbs(typeContract as TypeContract);
	triggers.push(
		...linkVerbs.flatMap((lv) =>
			createLinkTrigger(
				reverseRelationship(relationships, typeContract.slug, lv),
				typeContract,
			),
		),
	);

	return triggers;
};

/**
 * Creates a triggered action that fires when a contract gets changed that is linked
 * with the given link verb to a contract of the given type
 *
 * @param relationshipGroups - relationship groups
 * @param typeContract - the type containing the formula that needs the trigger
 * @returns the triggered action
 */
const createLinkTrigger = (
	relationshipGroups: Dictionary<RelationshipContract[]>,
	typeContract: TypeContract,
): PartialTriggeredActionContract[] => {
	if (Object.keys(relationshipGroups).length === 0) {
		return [];
	}
	return Object.entries(relationshipGroups)
		.filter(([, relationships]) => relationships.length)
		.map(([linkVerb, relationships]) => {
			// We try to optimize query speed by limiting to valid types or,
			// if all are allowed, by excluding some high frequency internal contracts
			const typeFilter =
				relationships.filter((r) => r.data.from.type === '*').length === 0
					? {
							enum: relationships.map((t) => `${t.data.from.type}@1.0.0`),
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
