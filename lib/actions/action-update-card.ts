import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import { WorkerNoElement } from '../errors';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	const typeContract = (await context.getCardBySlug(
		session,
		contract.type,
	))! as TypeContract;

	assert.USER(
		request.logContext,
		typeContract,
		WorkerNoElement,
		`No such type: ${contract.type}`,
	);

	const result = await context.patchCard(
		session,
		typeContract,
		{
			timestamp: request.timestamp,
			reason: request.arguments.reason,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		contract,
		request.arguments.patch,
	);

	if (!result) {
		return {
			id: contract.id,
			type: contract.type,
			version: contract.version,
			slug: contract.slug,
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
		name: 'Update properties of a contract',
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
