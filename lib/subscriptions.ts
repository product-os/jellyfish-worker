import type {
	Contract,
	JsonSchema,
	SessionContract,
	TypeContract,
} from 'autumndb';
import type { CreateContract } from './types';
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
		schema: JsonSchema,
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
    const fromTypes = ['message', 'whisper'];
    console.log('fromTypes:', JSON.stringify(fromTypes, null, 4));
	if (
		oldContract ||
		newContract.type !== 'link@1.0.0' ||
		newContract.name !== 'is attached to' ||
        !fromTypes.includes(newContract.data.from.type.split('@')[0])
	) {
		return;
	}

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
