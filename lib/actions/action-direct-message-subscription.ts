import { TypeContract } from 'autumndb';
import { strict as assert } from 'assert';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	thread,
	request,
) => {
	const actors: string[] = request.arguments.actors;
	for (const slug of actors) {
		// Insert the subscription and link on behalf of the user
		const actor = await context.getCardBySlug(
			context.privilegedSession,
			`${slug}@latest`,
		);
		assert(actor);
		const actorSession = { actor };

		const subscription = await context.insertCard(
			actorSession,
			context.cards['subscription@1.0.0'] as TypeContract,
			{
				timestamp: request.timestamp,
				actor: actor.id,
				originator: request.originator,
				attachEvents: true,
			},
			{},
		);

		assert(subscription);

		// Create a link card between the subscription and the thread
		await context.insertCard(
			actorSession,
			context.cards['link@1.0.0'] as TypeContract,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			{
				type: 'link@1.0.0',
				name: 'is attached to',
				data: {
					inverseName: 'has attached',
					from: {
						id: subscription.id,
						type: subscription.type,
					},
					to: {
						id: thread.id,
						type: thread.type,
					},
				},
			},
		);
	}

	return {
		id: thread.id,
		type: thread.type,
		version: thread.version,
		slug: thread.slug,
	};
};

export const actionDirectMessageSubscription: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-direct-message-subscription',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Subscribe users to a direct message thread',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						const: 'thread@1.0.0',
					},
					data: {
						type: 'object',
						required: ['dms', 'actors'],
						properties: {
							dms: {
								const: true,
								type: 'boolean',
							},
							actors: {
								type: 'array',
							},
						},
					},
				},
			},
			arguments: {
				actors: {
					type: 'array',
				},
			},
		},
	},
};
