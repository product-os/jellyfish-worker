import type { TypeContract } from '@balena/jellyfish-types/build/core';
import * as bcrypt from 'bcrypt';
import type { ActionDefinition } from '../plugin';
import { BCRYPT_SALT_ROUNDS, PASSWORDLESS_USER_HASH } from './constants';

const pre: ActionDefinition['pre'] = async (_session, _context, request) => {
	const password = request.arguments.password;

	if (!password) {
		return {
			...request.arguments,
			password: PASSWORDLESS_USER_HASH,
		};
	}

	// Convert the plaintext password into a hash so that we don't have
	// a plain password stored in the DB
	request.arguments.password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

	return request.arguments;
};

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	try {
		const result = await context.insertCard(
			context.privilegedSession,
			contract as TypeContract,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: true,
			},
			{
				slug: request.arguments.username,
				version: '1.0.0',
				data: {
					email: request.arguments.email,
					roles: ['user-community'],
					hash: request.arguments.password,
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
	} catch (error: any) {
		if (
			error.name === 'JellyfishElementAlreadyExists' &&
			error.slug === request.arguments.username
		) {
			error.expected = true;
		}

		throw error;
	}
};

export const actionCreateUser: ActionDefinition = {
	pre,
	handler,
	contract: {
		slug: 'action-create-user',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Create a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					slug: {
						type: 'string',
						const: 'user',
					},
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
				required: ['slug', 'type'],
			},
			arguments: {
				username: {
					type: 'string',
					pattern: '^user-[a-zA-Z0-9-]{4,}$',
				},
				email: {
					type: 'string',
					format: 'email',
				},
				password: {
					type: 'string',
				},
			},
		},
	},
};
