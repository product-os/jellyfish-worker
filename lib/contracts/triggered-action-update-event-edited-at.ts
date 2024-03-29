import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionUpdateEventEditedAt: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-update-event-edited-at',
		type: 'triggered-action@1.0.0',
		name: "Triggered action for updating the event's edited_at field when the payload is updated",
		markers: [],
		data: {
			schedule: 'sync',
			filter: {
				$$links: {
					'is attached to': {
						type: 'object',
						required: ['active', 'type'],
						properties: {
							active: {
								type: 'boolean',
								const: true,
							},
							type: {
								type: 'string',
								enum: ['message@1.0.0', 'whisper@1.0.0'],
							},
						},
					},
				},
				type: 'object',
				required: ['active', 'type', 'data'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					type: {
						type: 'string',
						const: 'update@1.0.0',
					},
					data: {
						type: 'object',
						required: ['payload'],
						properties: {
							payload: {
								type: 'array',
								contains: {
									type: 'object',
									required: ['op', 'path'],
									properties: {
										op: {
											type: 'string',
											enum: ['replace', 'add', 'remove'],
										},
										path: {
											type: 'string',
											pattern: '^/data/payload/.*',
										},
									},
								},
							},
						},
					},
				},
			},
			action: 'action-update-card@1.0.0',
			target: {
				$eval: "source.links['is attached to'][0].id",
			},
			arguments: {
				reason: 'Event was edited',
				patch: [
					{
						op: 'add',
						path: '/data/edited_at',
						value: {
							$eval: "source.links['is attached to'][0].updated_at",
						},
					},
				],
			},
		},
	};
