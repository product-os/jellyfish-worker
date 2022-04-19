import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { mergeProperties } from './transformer-merge-properties';

export const serviceSource: ContractDefinition = {
	slug: 'service-source',
	version: '1.0.0',
	name: 'Source bundle for a service',
	type: 'type@1.0.0',
	data: {
		schema: {
			type: 'object',
			required: ['data'],
			properties: {
				data: {
					type: 'object',
					properties: {
						$transformer: {
							type: 'object',
							properties: {
								...mergeProperties,
								mergeable: {
									description: 'all platforms have an image',
									type: 'boolean',
									$$formula: 'EVERY(VALUES(contract.data.platforms), "image")',
									readOnly: true,
									default: false,
								},
							},
						},
					},
				},
			},
		},
	},
};
