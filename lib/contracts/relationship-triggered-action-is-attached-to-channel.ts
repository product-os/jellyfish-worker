import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipTriggeredActionIsAttachedToChannel: RelationshipContractDefinition =
	{
		slug: 'relationship-triggered-action-is-attached-to-channel',
		type: 'relationship@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			title: 'Triggered action',
			inverseTitle: 'Channel',
			from: {
				type: 'triggered-action',
			},
			to: {
				type: 'channel',
			},
		},
	};
