import { ActionDefinition } from '../';
import { actionCreateEvent } from './action-create-event';

const actionCreateEventHandler = actionCreateEvent.handler;

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const eventBaseType = 'message';
	const eventType = `${eventBaseType}@1.0.0`;

	const messages = await context.query(context.privilegedSession, {
		type: 'object',
		$$links: {
			'is attached to': {
				type: 'object',
				required: ['id'],
				properties: {
					id: {
						type: 'string',
						const: card.id,
					},
				},
			},
		},
		required: ['type', 'data'],
		properties: {
			type: {
				type: 'string',
				const: eventType,
			},
			data: {
				type: 'object',
				additionalProperties: true,
				required: ['payload', 'actor'],
				properties: {
					payload: {
						type: 'object',
						required: ['message'],
						properties: {
							message: {
								type: 'string',
								const: request.arguments.message,
							},
						},
					},
				},
			},
		},
	});

	// If the message has already been broadcasted, don't send it again
	if (messages.length > 0) {
		return null;
	}

	const eventRequest = Object.assign({}, request);
	eventRequest.arguments = {
		slug: await context.getEventSlug(`broadcast-${eventType.split('@')[0]}`),
		type: eventType.split('@')[0],
		payload: {
			mentionsUser: [],
			alertsUser: [],
			mentionsGroup: [],
			alertsGroup: [],
			message: request.arguments.message,
		},
	};

	return actionCreateEventHandler(session, context, card, eventRequest);
};

export const actionBroadcast: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-broadcast',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Broadcast a message',
		data: {
			arguments: {
				message: {
					type: 'string',
				},
			},
			required: ['message'],
		},
	},
};
