import type { ContractDefinition } from 'autumndb';

/**
 * `contract-repository` is a bucket for contracts with the same slug but different versions.
 * It's expected that when a repository for a base slug exists, that all contracts with that slug
 * are linked with this repository.
 * The `latest` link should point to the greatest non-pre-release version with the given slug.
 */
export const contractRepository: ContractDefinition = {
	slug: 'contract-repository',
	version: '1.0.0',
	name: 'Repository',
	type: 'type@1.0.0',
	data: {
		schema: {
			type: 'object',
			required: ['data', 'slug'],
			properties: {
				slug: {
					type: 'string',
					pattern: '^contract-repository-.*',
				},
				data: {
					type: 'object',
					required: ['base_slug', 'base_type'],
					properties: {
						base_slug: {
							type: 'string',
						},
						base_type: {
							type: 'string',
						},
					},
				},
			},
		},
		indexed_fields: [['data.base_slug'], ['data.base_type']],
	},
};
