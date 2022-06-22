import type {
	ContractDefinition,
	TypeData,
} from '@balena/jellyfish-types/build/core';

export const channel: ContractDefinition<TypeData> = {
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
