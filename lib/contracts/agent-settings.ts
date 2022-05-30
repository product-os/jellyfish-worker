import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const agentSettings: ContractDefinition = {
	slug: 'agent-settings',
	type: 'type@1.0.0',
	name: 'Agent Settings',
	data: {
		schema: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					pattern: '^agent-settings-[a-z0-9-]+$',
				},
				data: {
					type: 'object',
				},
			},
		},
	},
};
