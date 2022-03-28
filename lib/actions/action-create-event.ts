import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import { errors as coreErrors } from 'autumndb';
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
		`${request.arguments.type}@1.0.0`,
	))! as TypeContract;

	// In most cases, the `card` argument will contain all the information we
	// need, but in some instances (for example when the guest user session
	// creates a new user), `card` will be missing certain fields due to
	// a permission filter being applied. The full contract is loaded using
	// a privileged sessions so that we can ensure all required fields are
	// present.
	const fullContract = (await context.getCardById(
		context.privilegedSession,
		contract.id,
	))!;

	assert.USER(
		request.logContext,
		typeContract,
		WorkerNoElement,
		`No such type: ${request.arguments.type}`,
	);

	const data = {
		timestamp: request.timestamp,
		target: fullContract.id,
		actor: request.actor,
		payload: request.arguments.payload,
	};

	const result = (await context
		.insertCard(
			session,
			typeContract,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			{
				slug:
					request.arguments.slug ||
					(await context.getEventSlug(typeContract.slug)),
				version: '1.0.0',
				name: request.arguments.name || null,
				tags: request.arguments.tags || [],

				// Events always inherit the head contracts markers
				markers: fullContract.markers,
				data,
			},
		)
		.catch((error: unknown) => {
			// This is a user error
			if (error instanceof coreErrors.JellyfishElementAlreadyExists) {
				error.expected = true;
			}

			throw error;
		}))!;

	const linkTypeContract = (await context.getCardBySlug(
		session,
		'link@1.0.0',
	))! as TypeContract;

	// Create a link card between the event and its target
	await context.insertCard(
		session,
		linkTypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: false,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'is attached to',
			data: {
				inverseName: 'has attached element',
				from: {
					id: result.id,
					type: result.type,
				},
				to: {
					id: fullContract.id,
					type: fullContract.type,
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
	};
};

export const actionCreateEvent: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-create-event',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Attach an event to a contract',
		data: {
			arguments: {
				tags: {
					type: 'array',
					items: {
						type: 'string',
					},
				},
				slug: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				name: {
					type: 'string',
				},
				type: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				payload: {
					type: 'object',
				},
			},
			required: ['type', 'payload'],
		},
	},
};
