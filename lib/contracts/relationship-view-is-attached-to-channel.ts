import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipViewIsAttachedToChannel: RelationshipContractDefinition =
	{
		slug: 'relationship-view-is-attached-to-channel',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'View',
			inverseTitle: 'Channel',
			from: {
				type: 'view',
			},
			to: {
				type: 'channel',
			},
		},
	};
