import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from 'autumndb';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	card,
	request,
) => {
	if (!card.active) {
		return {
			id: card.id,
			type: card.type,
			version: card.version,
			slug: card.slug,
		};
	}

	const typeCard = context.cards[card.type] as TypeContract;
	assert.USER(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const result = await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		[
			{
				op: 'replace',
				path: '/active',
				value: false,
			},
		],
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

export const actionDeleteCard: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-delete-card',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Delete a card',
		data: {
			extends: 'action-update-card',
			arguments: {},
		},
	},
};
