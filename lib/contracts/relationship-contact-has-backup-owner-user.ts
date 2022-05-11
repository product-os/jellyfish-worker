import type { RelationshipContractDefinition } from 'autumndb';

export const relationshipContactHasBackupOwnerUser: RelationshipContractDefinition =
	{
		slug: 'relationship-contact-has-backup-owner-user',
		type: 'relationship@1.0.0',
		name: 'has backup owner',
		data: {
			inverseName: 'is backup owner of',
			title: 'Backup owner',
			inverseTitle: '(Backup owned) contact',
			from: {
				type: 'contact',
			},
			to: {
				type: 'user',
			},
		},
	};
