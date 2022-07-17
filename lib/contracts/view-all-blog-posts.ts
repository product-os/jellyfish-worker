import type { ViewContractDefinition } from 'autumndb';

export const viewAllBlogPosts: ViewContractDefinition = {
	slug: 'view-all-blog-posts',
	name: 'Blog posts',
	type: 'view@1.0.0',
	markers: ['org-balena'],
	data: {
		allOf: [
			{
				name: 'All blog-posts',
				schema: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							const: 'blog-post@1.0.0',
						},
					},
					additionalProperties: true,
					required: ['type'],
				},
			},
		],
	},
};
