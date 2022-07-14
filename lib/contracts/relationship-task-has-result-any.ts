import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipTaskHasResultAny: RelationshipContractDefinition = {
	slug: 'relationship-task-has-result-any',
	type: 'relationship@1.0.0',
	name: 'has result',
	data: {
		inverseName: 'is result of',
		title: 'Result',
		inverseTitle: 'Task',
		from: {
			type: 'task',
		},
		to: {
			type: '*',
		},
	},
};
