import * as assert from '@balena/jellyfish-assert';
import type { Contract, TypeContract } from 'autumndb';
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
import type { WorkerContext } from '../types';
import { BCRYPT_SALT_ROUNDS } from './constants';

const AUTH_LINK_VERB = 'is authenticated with';

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

	const [fullUser] = await getUser(context, userContract);

	const userHash = fullUser?.links?.[AUTH_LINK_VERB][0].data.hash;

	assert.USER(
		request.logContext,
		userHash,
		WorkerAuthenticationError,
		'Login disallowed',
	);

	const matches = await bcrypt.compare(
		request.arguments.password,
		userHash as string,
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
	_session,
	context,
	contract,
	request,
) => {
	const [user] = await getUser(context, contract);

	assert.USER(
		request.logContext,
		user,
		WorkerAuthenticationError,
		`No such user: ${contract.id}`,
	);
	assert.USER(
		request.logContext,
		user?.links?.[AUTH_LINK_VERB][0].data.hash,
		WorkerAuthenticationError,
		'Login disallowed',
	);

	const sessionTypeContract = context.cards['session@1.0.0'] as TypeContract;
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
			attachEvents: false,
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

function getUser(
	context: WorkerContext,
	userContract: any,
): Promise<Contract[]> {
	return context.query(context.privilegedSession, {
		type: 'object',
		properties: {
			active: {
				const: true,
			},
			type: {
				type: 'string',
				const: 'user@1.0.0',
			},
			id: {
				type: 'string',
				const: userContract.id,
			},
		},
		$$links: {
			[AUTH_LINK_VERB]: {
				type: 'object',
				required: ['type'],
				properties: {
					active: {
						const: true,
					},
					type: {
						const: 'authentication-password@1.0.0',
					},
				},
			},
		},
		required: ['type'],
	});
}
