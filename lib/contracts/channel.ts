import type { ContractDefinition } from 'autumndb';

export const channel: ContractDefinition = {
	slug: 'channel',
	name: 'Channel',
	type: 'type@1.0.0',
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					required: ['filter'],
					properties: {
						filter: {
							description:
								'Contracts matching this filter will be handled by the channel',
							type: 'object',
						},
					},
				},
			},
		},
	},
};
