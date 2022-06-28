import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const agentChannelSettings: ContractDefinition = {
	slug: 'agent-channel-settings',
	name: 'Agent Channel Settings',
	type: 'type@1.0.0',
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					properties: {
						optIn: {
							description: 'Opt-in to own the next available channel contract',
							type: 'boolean',
							default: false,
						},
					},
				},
			},
		},
	},
};
