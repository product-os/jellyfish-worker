import find from 'lodash/find';
import * as skhema from 'skhema';
import { core, JSONSchema } from '@balena/jellyfish-types';

export interface EvaluateOptions {
	subscription: core.Contract;
	oldCard: core.Contract<any> | null;
	newCard: core.Contract<any>;
	insertCard: (
		typeCard: core.TypeContract,
		actorSession: string,
		object: any,
	) => Promise<core.Contract | null>;
	getCreatorSession: (
		card: core.Contract,
	) => Promise<core.SessionContract | null>;
	query: <TContract extends core.Contract = core.Contract>(
		schema: JSONSchema,
		opts?: { sortBy?: string; sortDir?: 'asc' | 'desc'; limit?: number },
	) => Promise<TContract[]>;
	getCardBySlug: <TContract extends core.Contract = core.Contract>(
		slug: string,
	) => Promise<TContract | null>;
	matchesCard: (
		actorSession: string,
		schema: JSONSchema,
		card: core.Contract,
	) => Promise<core.Contract | false | undefined>;
}

/*
 * Notification will be generated in following cases:
 * 1. Inserted card is a link which makes subscription schema valid;
 * 2. Inserted card matches subscription schema after update;
 */
export const evaluate = async ({
	subscription,
	oldCard,
	newCard,
	insertCard,
	getCreatorSession,
	matchesCard,
	getCardBySlug,
}: EvaluateOptions) => {
	const view = find(
		subscription.links!['is attached to'] as core.ViewContract[],
		{
			type: 'view@1.0.0',
		},
	);

	if (!view || !view.data.allOf || !view.data.allOf.length) {
		return;
	}

	const schema = view.data.allOf[0].schema;

	if (newCard.type.split('@')[0] !== 'link') {
		const matchesNow = skhema.isValid(schema as any, newCard);

		if (!matchesNow) {
			return;
		}

		if (oldCard) {
			const matchedPreviously = skhema.isValid(schema as any, oldCard);

			if (matchedPreviously) {
				return;
			}
		}
	}

	const creatorSession = await getCreatorSession(subscription);

	if (!creatorSession) {
		return;
	}

	const filteredCard = await matchesCard(creatorSession.id, schema, newCard);

	if (!filteredCard) {
		return;
	}

	const notificationTypeCard = await getCardBySlug<core.TypeContract>(
		'notification@1.0.0',
	);

	if (!notificationTypeCard) {
		return;
	}

	let notification: core.Contract | null = null;
	try {
		notification = await insertCard(notificationTypeCard, creatorSession.id, {
			version: '1.0.0',
			type: 'notification@1.0.0',
			slug: `notification-${filteredCard.id}`,
			tags: [],
			links: {},
			requires: [],
			capabilities: [],
			active: true,
		});
	} catch (err) {
		if (err.message === 'JellyfishElementAlreadyExists') {
			return;
		}

		throw err;
	}

	if (!notification) {
		return;
	}

	const linkTypeContract = await getCardBySlug<core.TypeContract>('link@1.0.0');

	if (!linkTypeContract) {
		return;
	}

	try {
		await insertCard(linkTypeContract, creatorSession.id, {
			version: '1.0.0',
			type: 'link@1.0.0',
			slug: `link-${filteredCard.id}-has-attached-${notification.id}`,
			tags: [],
			links: {},
			requires: [],
			capabilities: [],
			active: true,
			name: 'has attached',
			data: {
				inverseName: 'is attached to',
				from: {
					id: filteredCard.id,
					type: filteredCard.type,
				},
				to: {
					id: notification.id,
					type: notification.type,
				},
			},
		});
	} catch (err) {
		if (err.message === 'JellyfishElementAlreadyExists') {
			return;
		}

		throw err;
	}
};
