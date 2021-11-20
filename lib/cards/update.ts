export default {
	slug: 'update',
	type: 'type@1.0.0',
	version: '1.0.0',
	name: 'The card update event',
	markers: [],
	tags: [],
	links: {},
	active: true,
	data: {
		schema: {
			type: 'object',
			properties: {
				version: {
					type: 'string',
					const: '1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						timestamp: {
							type: 'string',
							format: 'date-time',
						},
						target: {
							type: 'string',
							format: 'uuid',
						},
						actor: {
							type: 'string',
							format: 'uuid',
						},
						payload: {
							type: 'array',
						},
					},
					required: ['timestamp', 'target', 'actor', 'payload'],
				},
			},
			required: ['version', 'data'],
		},
	},
	requires: [],
	capabilities: [],
};
