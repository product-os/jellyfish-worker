import type { TriggeredActionContractDefinition } from '../types';

export const triggeredActionOrgCreationMembership: TriggeredActionContractDefinition =
	{
		slug: 'triggered-action-org-creation-membership',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for automatically making an org creator a member',
		markers: [],
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						const: 'org@1.0.0',
					},
				},
			},
			action: 'action-create-card@1.0.0',
			target: 'link@1.0.0',
			arguments: {
				reason: null,
				properties: {
					name: 'has member',
					data: {
						inverseName: 'is member of',
						from: {
							id: {
								$eval: 'source.id',
							},
							type: {
								$eval: 'source.type',
							},
						},
						to: {
							id: {
								$eval: 'actor.id',
							},
							type: {
								$eval: 'actor.type',
							},
						},
					},
				},
			},
		},
	};
