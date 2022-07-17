import type { Contract, TypeContract } from 'autumndb';
import type { ActionHandlerRequest, WorkerContext } from '../types';

/**
 * @summary Add link between user card and another card
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @param fromCard - card to link from
 * @param userCard - user card to link to
 */
export async function addLinkCard(
	context: WorkerContext,
	request: ActionHandlerRequest,
	fromCard: Contract,
	userCard: Contract,
): Promise<void> {
	const linkTypeCard = (await context.getCardBySlug(
		context.privilegedSession,
		'link@1.0.0',
	))! as TypeContract;
	await context.insertCard(
		context.privilegedSession,
		linkTypeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: false,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'is attached to',
			data: {
				inverseName: 'has requested',
				from: {
					id: fromCard.id,
					type: fromCard.type,
				},
				to: {
					id: userCard.id,
					type: userCard.type,
				},
			},
		},
	);
}
