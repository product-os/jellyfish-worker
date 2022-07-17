import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipProjectHasCheckin: RelationshipContractDefinition = {
	slug: 'relationship-project-has-checkin',
	type: 'relationship@1.0.0',
	name: 'has',
	data: {
		inverseName: 'is of',
		title: 'Checkin',
		inverseTitle: 'Project',
		from: {
			type: 'project',
		},
		to: {
			type: 'checkin',
		},
	},
};
