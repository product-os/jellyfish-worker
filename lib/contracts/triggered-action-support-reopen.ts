import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionSupportReopen: TriggeredActionContractDefinition = {
	slug: 'triggered-action-support-reopen',
	type: 'triggered-action@1.0.0',
	name: 'Triggered action for reopening support threads because of activity',
	markers: [],
	data: {
		schedule: 'sync',
		filter: {
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['type', 'data'],
					properties: {
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
									not: {
										const: 'open',
									},
								},
							},
						},
					},
				},
			},
			type: 'object',
			required: ['active', 'type'],
			properties: {
				active: {
					type: 'boolean',
					const: true,
				},
				type: {
					type: 'string',
					const: 'message@1.0.0',
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
		mode: 'insert',
		arguments: {
			reason: 'Support Thread re-opened because of activity',
			patch: [
				{
					op: 'replace',
					path: '/data/status',
					value: 'open',
				},
			],
		},
	},
};
