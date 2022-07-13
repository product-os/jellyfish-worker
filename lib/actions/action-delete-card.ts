import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from 'autumndb';
import { ActionDefinition, errors } from '../';

const handler: ActionDefinition['handler'] = async (
	session,
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

	const typeCard = (await context.getCardBySlug(
		session,
		card.type,
	))! as TypeContract;
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
