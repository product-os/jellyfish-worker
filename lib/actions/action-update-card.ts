import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import { WorkerNoElement } from '../errors';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = (await context.getCardBySlug(
		session,
		card.type,
	))! as TypeContract;

	assert.USER(
		request.logContext,
		typeCard,
		WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const result = await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			reason: request.arguments.reason,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		request.arguments.patch,
	);

	if (!result) {
		return {
			id: card.id,
			type: card.type,
			version: card.version,
			slug: card.slug,
		};
	}

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug,
	};
};

export const actionUpdateCard: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-update-card',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Update properties of a card',
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				patch: {
					type: 'array',
				},
			},
		},
	},
};
