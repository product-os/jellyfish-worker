import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipAccountHasBackupOwnerUser: RelationshipContractDefinition =
	{
		slug: 'relationship-account-has-backup-owner-user',
		type: 'relationship@1.0.0',
		name: 'has backup owner',
		data: {
			inverseName: 'is backup owner of',
			title: 'Backup owner',
			inverseTitle: '(Backup owned) account',
			from: {
				type: 'account',
			},
			to: {
				type: 'user',
			},
		},
	};
