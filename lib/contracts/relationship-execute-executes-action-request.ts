import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipExecuteExecutesActionRequest: RelationshipContractDefinition =
	{
		slug: 'relationship-execute-executes-action-request',
		type: 'relationship@1.0.0',
		name: 'executes',
		data: {
			inverseName: 'is executed by',
			title: 'Executor',
			inverseTitle: 'Action',
			from: {
				type: 'execute',
			},
			to: {
				type: 'action-request',
			},
		},
	};
