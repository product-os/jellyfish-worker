import * as assert from '@balena/jellyfish-assert';
import type { TypeContract, UserContract } from 'autumndb';
import { WorkerInvalidActionRequest, WorkerNoElement } from '../errors';
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

	// Restrict user contract updates
	// TODO: This is a temporary solution until we have a better way to handle this.
	// Once we are able to distinctly permission writes in AutumnDB, we can remove this.
	if (typeContract.slug === 'user') {
		assert.USER(
			request.logContext,
			contract.id === session.actor.id ||
				session.actor.slug === 'user-admin' ||
				(session.actor as UserContract).data.roles.includes('user-operator'),
			WorkerInvalidActionRequest,
			'You are not allowed to update other user contracts',
		);
	}

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
