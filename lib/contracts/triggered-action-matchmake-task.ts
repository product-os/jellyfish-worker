import type { ContractDefinition } from 'autumndb';

export const triggeredActionMatchmakeTask: ContractDefinition = {
	slug: 'triggered-action-matchmake-task',
	version: '1.0.0',
	type: 'triggered-action@1.0.0',
	name: 'Triggered action for matchmaking tasks to agents',
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
					const: 'create@1.0.0',
				},
				data: {
					type: 'object',
					required: ['payload'],
					properties: {
						payload: {
							type: 'object',
							properties: {
								slug: {
									type: 'string',
								},
								type: {
									type: 'string',
									const: 'task@1.0.0',
								},
							},
						},
					},
				},
			},
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						id: {
							type: 'string',
						},
						type: {
							type: 'string',
							const: 'task@1.0.0',
						},
					},
				},
			},
		},
		action: 'action-matchmake-task@1.0.0',

		// eslint-disable-next-line
		target: {
			$eval: "source.links['is attached to'][0].id",
		},
		arguments: {},
	},
};
