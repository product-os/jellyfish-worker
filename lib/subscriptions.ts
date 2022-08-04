import type {
	AutumnDBSession,
	Contract,
	JsonSchema,
	TypeContract,
	UserContract,
} from 'autumndb';
import type { CreateContract } from './types';
import { find, without } from 'lodash';
import _ from 'lodash';
import { getLogger, LogContext } from '@balena/jellyfish-logger';

const logger = getLogger('subscriptions');

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

const getMentions = (message: Contract<any>): string[] => {
	return (
		message.data.payload?.mentionsUser?.concat(
			message.data.payload?.alertsUser || [],
		) || []
	);
};

const getChatGroups = (message: Contract<any>): string[] => {
	return (
		message.data.payload?.mentionsGroup?.concat(
			message.data.payload?.alertsGroup || [],
		) || []
	);
};

const attachNotificationToMessage = async (
	{
		getTypeContract,
		insertContract,
		privilegedSession,
		logContext,
	}: {
		logContext: LogContext;
		getTypeContract: EvaluateOptions['getTypeContract'];
		insertContract: EvaluateOptions['insertContract'];
		privilegedSession: EvaluateOptions['privilegedSession'];
	},
	{
		message,
		receiver,
	}: {
		message: Contract;
		creatorSession: AutumnDBSession;
		receiver: UserContract;
	},
) => {
	const notificationTypeContract = getTypeContract('notification@1.0.0');

	if (!notificationTypeContract) {
		return;
	}

	const date = new Date();

	return insertContract(
		getTypeContract('action-request@1.0.0'),
		privilegedSession,
		{
			data: {
				card: notificationTypeContract.id,
				action: 'action-create-card@1.0.0',
				actor: privilegedSession.actor.id,
				context: logContext,
				input: {
					id: notificationTypeContract.id,
				},
				epoch: date.valueOf(),
				timestamp: date.toISOString(),
				arguments: {
					reason: null,
					properties: {
						markers: [receiver.slug],
						slug: `notification-${receiver.slug}-${message.id}`,
						links: {
							'is attached to': [
								{
									id: message.id,
									slug: message.slug,
									type: message.type,
								},
							],
							notifies: [
								{
									id: receiver.id,
									slug: receiver.slug,
									type: receiver.type,
								},
							],
						},
					},
				},
			},
		},
		receiver.id,
	);
};

export interface EvaluateOptions {
	oldContract: Contract<any> | null;
	newContract: Contract<any>;
	session: AutumnDBSession;
	privilegedSession: AutumnDBSession;
	getTypeContract: (type: string) => TypeContract;
	insertContract: (
		typeCard: TypeContract,
		actorSession: AutumnDBSession,
		object: any,
		actor: string,
	) => Promise<Contract | null>;
	query: <TContract extends Contract = Contract>(
		schema: JsonSchema,
		opts?: { sortBy?: string; sortDir?: 'asc' | 'desc'; limit?: number },
	) => Promise<TContract[]>;
	getCreatorSession(creatorId: string): Promise<AutumnDBSession | null>;
	logContext: LogContext;
}

/*
 * Notification will be generated if the message is linked to the thread and user is subscribed to the thread
 */
export const evaluate = async ({
	logContext,
	oldContract,
	newContract,
	session,
	privilegedSession,
	getTypeContract,
	insertContract,
	getCreatorSession,
	query,
}: EvaluateOptions) => {
	if (newContract.type === 'message@1.0.0' || newContract.type === 'whisper') {
		const oldMentions = oldContract ? getMentions(oldContract) : [];
		const currentMentions = getMentions(newContract);
		const newMentions = without(currentMentions, ...oldMentions);

		const oldGroupMentions = oldContract ? getChatGroups(oldContract) : [];
		const currentGroupMentions = getChatGroups(newContract);
		const newGroupMentions = without(currentGroupMentions, ...oldGroupMentions);

		if (newGroupMentions.length) {
			for (const group of newGroupMentions) {
				const users = await query({
					type: 'object',
					properties: {
						active: {
							const: true,
						},
						type: {
							const: 'user@1.0.0',
						},
					},
					$$links: {
						'is group member of': {
							type: 'object',
							properties: {
								type: {
									const: 'group@1.0.0',
								},
								name: {
									const: group,
								},
							},
						},
					},
				});

				newMentions.push(..._.map(users, 'slug'));
			}
		}

		if (newMentions.length) {
			// Batch the notification creation in blocks of 5 to avoid overwhelming the DB
			const chunks = _.chunk(newMentions, 5);
			for (const batch of chunks) {
				await Promise.all(
					batch.map(async (newMention) => {
						try {
							const receiver =
								typeof newMention === 'string'
									? _.first(
											await query<UserContract>(
												{
													type: 'object',
													properties: {
														slug: {
															const: newMention,
														},
													},
												},
												{ limit: 1 },
											),
									  )
									: newMention;

							if (receiver) {
								return attachNotificationToMessage(
									{
										getTypeContract,
										insertContract,
										privilegedSession,
										logContext,
									},
									{
										message: newContract,
										creatorSession: session,
										receiver,
									},
								);
							}
						} catch (e) {
							console.error(e);
							logger.error(
								logContext,
								'Failed to attach notification to message',
								{
									user: newMention,
									message: newContract.id,
									error: e,
								},
							);
						}
					}),
				);
			}
		}

		return;
	}

	if (
		oldContract ||
		newContract.type !== 'link@1.0.0' ||
		newContract.data.from.type !== 'message@1.0.0' ||
		newContract.name !== 'is attached to' ||
		!['support-thread@1.0.0', 'thread@1.0.0'].includes(newContract.data.to.type)
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
						enum: ['thread@1.0.0', 'support-thread@1.0.0'],
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

			const creatorSession = await getCreatorSession(creatorId);

			if (!creatorSession) {
				return;
			}

			// User already got notification, because he was mentioned
			if (getMentions(message).includes(creatorSession.actor.slug)) {
				return;
			}

			await attachNotificationToMessage(
				{
					getTypeContract,
					insertContract,
					privilegedSession,
					logContext,
				},
				{
					message,
					creatorSession,
					receiver: creatorSession.actor as UserContract,
				},
			);
		}),
	);
};
