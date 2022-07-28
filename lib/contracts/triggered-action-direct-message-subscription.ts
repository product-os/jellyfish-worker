import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionDirectMessageSubscription: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-direct-message-subscription',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for creating subscriptions to direct message threads for all participants',
		markers: [],
		data: {
			filter: {
				type: 'object',
				required: ['type', 'data'],
				properties: {
					type: {
						type: 'string',
						const: 'thread@1.0.0',
					},
					data: {
						type: 'object',
						required: ['dms', 'actors'],
						properties: {
							dms: {
								const: true,
							},
							actors: {
								type: 'array',
							},
						},
					},
				},
			},
			action: 'action-direct-message-subscription@1.0.0',
			target: {
				$eval: 'source.id',
			},
			arguments: {
				actors: {
					$eval: 'source.data.actors',
				},
			},
		},
	};
