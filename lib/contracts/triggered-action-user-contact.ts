import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionUserContact: TriggeredActionContractDefinition = {
	slug: 'triggered-action-user-contact',
	type: 'triggered-action@1.0.0',
	name: 'Triggered action for maintaining user contact information',
	markers: [],
	data: {
		filter: {
			type: 'object',
			required: ['type'],
			properties: {
				updated_at: {
					title: 'This should trigger on any update to the user',
				},
				type: {
					type: 'string',
					const: 'user@1.0.0',
				},
			},
		},
		action: 'action-maintain-contact@1.0.0',
		target: {
			$eval: 'source.id',
		},
		arguments: {},
	},
};
