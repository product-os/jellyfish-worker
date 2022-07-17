import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipOpportunityHasBackupOwnerUser: RelationshipContractDefinition =
	{
		slug: 'relationship-opportunity-has-backup-owner-user',
		type: 'relationship@1.0.0',
		name: 'has backup owner',
		data: {
			inverseName: 'is backup owner of',
			title: 'Backup owner',
			inverseTitle: '(Backup owned) opportunity',
			from: {
				type: 'opportunity',
			},
			to: {
				type: 'user',
			},
		},
	};
