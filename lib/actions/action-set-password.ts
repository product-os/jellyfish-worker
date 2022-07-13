import * as assert from '@balena/jellyfish-assert';
import { errors as autumndbErrors, TypeContract } from 'autumndb';
import bcrypt from 'bcrypt';
import { isEmpty } from 'lodash';
import { actionCreateSession } from './action-create-session';
import { BCRYPT_SALT_ROUNDS, PASSWORDLESS_USER_HASH } from './constants';
import { ActionDefinition, errors } from '../';

const pre: ActionDefinition['pre'] = async (session, context, request) => {
	const card = await context.getCardById(
		context.privilegedSession,
		request.card,
	);
	const isFirstTimePassword =
		card &&
		card.data &&
		card.data.hash === PASSWORDLESS_USER_HASH &&
		!request.arguments.currentPassword;

	// TS-TODO: This is broken
	const loginResult = {
		password: '',
	};
	if (!isFirstTimePassword && actionCreateSession.pre) {
		// This call will throw if the current password is incorrect.
		await actionCreateSession.pre(session, context, {
			action: 'TODOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
			type: 'TODOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO',
			card: request.card,
			logContext: request.logContext,
			arguments: {
				password: String(request.arguments.currentPassword),
			},
		});
		loginResult.password = 'CHECKED IN PRE HOOK';
	}

	// Don't store passwords in plain text
	request.arguments.currentPassword = loginResult.password;
	request.arguments.newPassword = await bcrypt.hash(
		request.arguments.newPassword,
		BCRYPT_SALT_ROUNDS,
	);

	return request.arguments;
};

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

	assert.INTERNAL(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	return context
		.patchCard(
			session,
			typeCard,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			card,
			[
				{
					op: isEmpty(request.arguments.currentPassword) ? 'add' : 'replace',
					path: '/data/hash',
					value: request.arguments.newPassword,
				},
			],
		)
		.catch((error: unknown) => {
			// A schema mismatch here means that the patch could
			// not be applied to the card due to permissions.
			if (error instanceof autumndbErrors.JellyfishSchemaMismatch) {
				const newError = new errors.WorkerAuthenticationError(
					'Password change not allowed',
				);
				throw newError;
			}

			throw error;
		});
};

export const actionSetPassword: ActionDefinition = {
	pre,
	handler,
	contract: {
		slug: 'action-set-password',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Set user password',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				currentPassword: {
					type: ['string', 'null'],
				},
				newPassword: {
					type: 'string',
				},
			},
		},
	},
};
