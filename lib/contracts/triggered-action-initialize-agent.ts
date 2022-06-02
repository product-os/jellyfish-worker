import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import type { TriggeredActionData } from '../';

export const triggeredActionInitializeAgent: ContractDefinition<TriggeredActionData> =
	{
		slug: 'triggered-action-initialize-agent',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for initializing agents',
		markers: [],
		data: {
			filter: {
				type: 'object',
				required: ['active', 'type', 'data'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					type: {
						type: 'string',
						const: 'link@1.0.0',
					},
					name: {
						type: 'string',
						const: 'has agent',
					},
					data: {
						type: 'object',
						required: ['from', 'to'],
						properties: {
							from: {
								type: 'object',
								required: ['type', 'id'],
								properties: {
									type: {
										type: 'string',
									},
									id: {
										type: 'string',
										format: 'uuid',
									},
								},
							},
							to: {
								type: 'object',
								required: ['type', 'id'],
								properties: {
									type: {
										type: 'string',
									},
									id: {
										type: 'string',
										format: 'uuid',
									},
								},
							},
						},
					},
				},
			},
			action: 'action-initialize-agent@1.0.0',
			target: '${source.data.to.id}',
			arguments: {},
		},
	};
