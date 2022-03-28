import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import * as bcrypt from 'bcrypt';
import { v4 as isUUID } from 'is-uuid';
import * as skhema from 'skhema';
import { v4 as uuidv4 } from 'uuid';
import {
	WorkerAuthenticationError,
	WorkerNoElement,
	WorkerSchemaMismatch,
} from '../errors';
import type { ActionDefinition } from '../plugin';
import { BCRYPT_SALT_ROUNDS } from './constants';

const pre: ActionDefinition['pre'] = async (session, context, request) => {
	// Validate scope schema if set.
	if (request.arguments.scope) {
		assert.USER(
			request.logContext,
			skhema.isValid(
				request.arguments.scope,
				{},
				{
					schemaOnly: true,
				},
			),
			WorkerSchemaMismatch,
			'Invalid schema for session scope',
		);
	} else {
		request.arguments.scope = {};
	}

	const userContract = (
		isUUID(request.card)
			? await context.getCardById(session, request.card)
			: await context.getCardBySlug(session, `${request.card}@latest`)
	)!;

	assert.USER(
		request.logContext,
		userContract,
		WorkerAuthenticationError,
		'Incorrect username or password',
	);

	const fullUser = (await context.getCardById(
		context.privilegedSession,
		userContract.id,
	))!;

	assert.USER(
		request.logContext,
		fullUser.data.hash,
		WorkerAuthenticationError,
		'Login disallowed',
	);

	const matches = await bcrypt.compare(
		request.arguments.password,
		fullUser.data.hash as string,
	);
	assert.USER(
		request.logContext,
		matches,
		WorkerAuthenticationError,
		'Invalid password',
	);

	// Don't store the plain text password in the
	// action request as we don't need it anymore.
	request.arguments.password = 'CHECKED IN PRE HOOK';

	return request.arguments;
};

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	const user = (await context.getCardById(
		context.privilegedSession,
		contract.id,
	))!;

	assert.USER(
		request.logContext,
		user,
		WorkerAuthenticationError,
		`No such user: ${contract.id}`,
	);
	assert.USER(
		request.logContext,
		user.data.hash,
		WorkerAuthenticationError,
		'Login disallowed',
	);

	const sessionTypeContract = (await context.getCardBySlug(
		session,
		'session@1.0.0',
	))! as TypeContract;

	assert.USER(
		request.logContext,
		sessionTypeContract,
		WorkerNoElement,
		'No such type: session',
	);

	// Set the expiration date to be 7 days from now
	const expirationDate = new Date();
	expirationDate.setDate(expirationDate.getDate() + 7);

	/*
	 * This allows us to differentiate two login requests
	 * coming on the same millisecond, unlikely but possible.
	 */
	const suffix = uuidv4();

	const secretToken = uuidv4();
	const secretTokenHash = await bcrypt.hash(secretToken, BCRYPT_SALT_ROUNDS);

	const result = await context.insertCard(
		context.privilegedSession,
		sessionTypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		{
			version: '1.0.0',
			slug: `session-${user.slug}-${request.epoch}-${suffix}`,
			data: {
				actor: contract.id,
				expiration: expirationDate.toISOString(),
				scope: request.arguments.scope,
				token: {
					authentication: secretTokenHash,
				},
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
		data: {
			token: {
				authentication: secretToken,
			},
		},
	};
};

export const actionCreateSession: ActionDefinition = {
	pre,
	handler,
	contract: {
		slug: 'action-create-session',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Login as a user',
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
				password: {
					type: 'string',
				},
				scope: {
					type: 'object',
					additionalProperties: true,
				},
			},
		},
	},
};
