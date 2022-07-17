import type { TypeContract } from 'autumndb';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const result = await context.replaceCard(
		session,
		card as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			reason: 'Ping',

			// So that we don't infinitely materialize links
			// in the ping card.
			attachEvents: false,
		},
		{
			slug: request.arguments.slug,
			version: '1.0.0',
			data: {
				timestamp: request.timestamp,
			},
		},
	);

	if (!result) {
		return null;
	}

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug,
	};
};

export const actionPing: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-ping',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Ping',
		data: {
			filter: {
				type: 'object',
				properties: {
					slug: {
						type: 'string',
						const: 'ping',
					},
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
				required: ['slug', 'type'],
			},
			arguments: {
				slug: {
					type: 'string',
					pattern: '^ping-[a-z0-9-]+$',
				},
			},
		},
	},
};
