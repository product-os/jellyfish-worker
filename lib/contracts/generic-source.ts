import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { mergeProperties } from './transformer-merge-properties';

export const genericSource: ContractDefinition = {
	slug: 'generic-source',
	version: '1.0.0',
	name: 'Generic source bundle',
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
							},
						},
					},
				},
			},
		},
	},
};
