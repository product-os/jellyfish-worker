import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionSupportSummary: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-support-summary',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for support summaries',
		markers: [],
		data: {
			filter: {
				type: 'object',
				$$links: {
					'is attached to': {
						type: 'object',
						required: ['active', 'type', 'data'],
						properties: {
							active: {
								type: 'boolean',
								const: true,
							},
							type: {
								type: 'string',
								const: 'support-thread@1.0.0',
							},
							data: {
								type: 'object',
								required: ['status'],
								properties: {
									status: {
										type: 'string',
										const: 'open',
									},
								},
							},
						},
					},
				},
				required: ['active', 'type', 'data'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					type: {
						type: 'string',
						const: 'whisper@1.0.0',
					},
					data: {
						type: 'object',
						required: ['payload'],
						properties: {
							payload: {
								type: 'object',
								required: ['message'],
								properties: {
									message: {
										type: 'string',
										pattern: '#summary',
									},
								},
							},
						},
					},
				},
			},
			action: 'action-update-card@1.0.0',
			target: {
				$map: {
					$eval: "source.links['is attached to'][0:]",
				},
				'each(link)': {
					$eval: 'link.id',
				},
			},
			arguments: {
				reason: 'Support Thread closed with #summary tag',
				patch: [
					{
						op: 'replace',
						path: '/data/status',
						value: 'closed',
					},
				],
			},
		},
	};
