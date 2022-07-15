import type { ContractDefinition } from 'autumndb';

export const roleLoop: ContractDefinition = {
	slug: 'role-loop',
	version: '1.0.0',
	name: 'Permissions assigned to a loop',
	type: 'role@1.0.0',
	markers: [],
	data: {
		read: {
			type: 'object',
		},
	},
};
