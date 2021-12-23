import type { JSONSchema } from '@balena/jellyfish-types';
import type {
	Contract,
	SessionContract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import type { CreateContract } from '@balena/jellyfish-types/build/worker';
import { find } from 'lodash';

/*
 * Get creator user from linked create contract
 */
const getCreatorId = (contract: Contract) => {
	const createContract = find(
		contract.links!['has attached element'] as CreateContract[],
		{
			type: 'create@1.0.0',
		},
	);

	if (!createContract || !createContract.data || !createContract.data.actor) {
		return null;
	}

	return createContract.data.actor;
};

export interface EvaluateOptions {
	oldContract: Contract<any> | null;
	newContract: Contract<any>;
	getTypeContract: (type: string) => TypeContract;
	insertContract: (
		typeCard: TypeContract,
		actorSession: string,
		object: any,
	) => Promise<Contract | null>;
	getSession: (userId: string) => Promise<SessionContract | null>;
	query: <TContract extends Contract = Contract>(
		schema: JSONSchema,
		opts?: { sortBy?: string; sortDir?: 'asc' | 'desc'; limit?: number },
	) => Promise<TContract[]>;
	getContractById: <TContract extends Contract = Contract>(
		id: string,
	) => Promise<TContract | null>;
}

/*
 * Notification will be generated if the message is linked to the thread and user is subscribed to the thread
 */
export const evaluate = async ({
	oldContract,
	newContract,
	getTypeContract,
	insertContract,
	getSession,
	getContractById,
	query,
}: EvaluateOptions) => {
	if (
		oldContract ||
		newContract.type !== 'link@1.0.0' ||
		newContract.data.from.type !== 'message@1.0.0' ||
		newContract.name !== 'is attached to' ||
		newContract.data.to.type !== 'support-thread@1.0.0'
	) {
		return;
	}

	const [message] = await query({
		type: 'object',
		required: ['id'],
		properties: {
			id: {
				const: newContract.data.from.id,
			},
		},
		$$links: {
			'is attached to': {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						const: 'support-thread@1.0.0',
					},
				},
				$$links: {
					'has attached': {
						type: 'object',
						required: ['type', 'active'],
						properties: {
							type: {
								const: 'subscription@1.0.0',
							},
							active: {
								const: true,
							},
						},
						$$links: {
							'has attached element': {
								type: 'object',
								properties: {
									type: {
										const: 'create@1.0.0',
									},
									data: {
										type: 'object',
										properties: {
											actor: {
												type: 'string',
											},
										},
										required: ['actor'],
									},
								},
								required: ['type', 'data'],
							},
						},
					},
				},
			},
		},
	});

	if (!message) {
		return;
	}

	const thread = message.links!['is attached to'][0];
	const subscriptions = thread.links!['has attached'];

	await Promise.all(
		subscriptions.map(async (subscription) => {
			const creatorId = getCreatorId(subscription);

			// Ignore if subscriber is the one who created a message
			if (!creatorId || creatorId === message.data.actor) {
				return;
			}

			const creator = await getContractById(creatorId);

			if (!creator) {
				return;
			}

			const creatorSession = await getSession(creatorId);

			if (!creatorSession) {
				return;
			}

			const notificationTypeContract = getTypeContract('notification@1.0.0');

			if (!notificationTypeContract) {
				return;
			}

			const notification = await insertContract(
				notificationTypeContract,
				creatorSession.id,
				{
					version: '1.0.0',
					type: 'notification@1.0.0',
					markers: [creator.slug],
					slug: `notification-${creator.id}-${message.id}`,
					tags: [],
					links: {},
					requires: [],
					capabilities: [],
					active: true,
				},
			);

			if (!notification) {
				return;
			}

			const linkTypeContract = getTypeContract('link@1.0.0');

			if (!linkTypeContract) {
				return;
			}

			await insertContract(linkTypeContract, creatorSession.id, {
				version: '1.0.0',
				type: 'link@1.0.0',
				slug: `link-${message.id}-has-attached-${notification.id}`,
				tags: [],
				links: {},
				requires: [],
				capabilities: [],
				active: true,
				name: 'has attached',
				data: {
					inverseName: 'is attached to',
					from: {
						id: message.id,
						type: message.type,
					},
					to: {
						id: notification.id,
						type: notification.type,
					},
				},
			});
		}),
	);
};
