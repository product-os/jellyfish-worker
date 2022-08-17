import { strict as assert } from 'assert';
import { errors as autumndbErrors, Contract, TypeContract } from 'autumndb';
import bcrypt from 'bcrypt';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';
import type { ActionHandlerRequest, WorkerContext } from '../types';
import { BCRYPT_SALT_ROUNDS } from './constants';

const pre: ActionDefinition['pre'] = async (_session, _context, request) => {
	// Convert the plaintext password into a hash so that we don't have a plain password stored in the DB
	request.arguments.newPassword = await bcrypt.hash(
		request.arguments.newPassword,
		BCRYPT_SALT_ROUNDS,
	);
	return request.arguments;
};

/**
 * @summary Get a password reset card from the backend
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @returns password reset card
 */
export async function getPasswordResetCard(
	context: WorkerContext,
	request: ActionHandlerRequest,
): Promise<Contract> {
	const [passwordResetCard] = await context.query(
		context.privilegedSession,
		{
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						active: {
							type: 'boolean',
							const: true,
						},
					},
				},
			},
			type: 'object',
			required: ['type', 'links', 'data'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				active: {
					type: 'boolean',
					const: true,
				},
				links: {
					type: 'object',
					additionalProperties: true,
				},
				data: {
					type: 'object',
					properties: {
						resetToken: {
							type: 'string',
							const: request.arguments.resetToken,
						},
					},
					required: ['resetToken'],
				},
			},
		},
		{
			limit: 1,
		},
	);
	return passwordResetCard;
}

/**
 * @summary Invalidate a password reset card
 * @function
 *
 * @param context - execution context
 * @param session - user session
 * @param request - action request
 * @param passwordResetCard - password reset card
 * @returns invalidated password reset card
 */
export async function invalidatePasswordReset(
	context: WorkerContext,
	request: ActionHandlerRequest,
	passwordResetCard: Contract,
): Promise<Contract> {
	const typeCard = (await context.getCardBySlug(
		context.privilegedSession,
		'password-reset@1.0.0',
	))! as TypeContract;
	return (await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		passwordResetCard,
		[
			{
				op: 'replace',
				path: '/active',
				value: false,
			},
		],
	))!;
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	_card,
	request,
) => {
	const passwordReset = await getPasswordResetCard(context, request);
	assert(
		passwordReset,
		new errors.WorkerInvalidActionRequest('Reset token invalid'),
	);

	await invalidatePasswordReset(context, request, passwordReset);

	const [user] =
		passwordReset.links && passwordReset.links['is attached to']
			? passwordReset.links['is attached to']
			: [null];
	assert(user, new errors.WorkerInvalidActionRequest('Reset token invalid'));

	const hasExpired =
		new Date(passwordReset.data.expiresAt as string) < new Date();
	if (hasExpired) {
		throw new errors.WorkerInvalidActionRequest(
			'Password reset token has expired',
		);
	}

	const userTypeCard = (await context.getCardBySlug(
		session,
		'user@latest',
	))! as TypeContract;

	return context
		.patchCard(
			context.privilegedSession,
			userTypeCard,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			user!,
			[
				{
					op: 'replace',
					path: '/data/hash',
					value: request.arguments.newPassword,
				},
			],
		)
		.catch((error: unknown) => {
			// A schema mismatch here means that the patch could
			// not be applied to the card due to permissions.
			if (error instanceof autumndbErrors.JellyfishSchemaMismatch) {
				// TS-TODO: Ensure this error is what is expected with Context type
				const newError = new errors.WorkerAuthenticationError(
					'Password change not allowed',
				);
				throw newError;
			}

			throw error;
		});
};

export const actionCompletePasswordReset: ActionDefinition = {
	pre,
	handler,
	contract: {
		slug: 'action-complete-password-reset',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Complete password reset',
		data: {
			arguments: {
				newPassword: {
					type: 'string',
				},
				resetToken: {
					type: 'string',
					pattern: '^[0-9a-fA-F]{64}$',
				},
			},
		},
	},
};

export { pre };
