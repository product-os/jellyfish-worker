import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipSupportThreadIsSourceForFeedbackItem: RelationshipContractDefinition =
	{
		slug: 'relationship-support-thread-is-source-for-feedback-item',
		type: 'relationship@1.0.0',
		name: 'is source for',
		data: {
			inverseName: 'is feedback for',
			title: 'Feedback item',
			inverseTitle: 'Support thread',
			from: {
				type: 'support-thread',
			},
			to: {
				type: 'feedback-item',
			},
		},
	};
