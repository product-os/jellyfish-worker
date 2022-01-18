import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import skhema from 'skhema';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	typeContract,
	request,
) => {
	assert.INTERNAL(
		request.logContext,
		!skhema.isValid(
			context.cards.event.data.schema as any,
			request.arguments.properties,
		),
		Error,
		'You may not use card actions to create an event',
	);

	const result = await context.insertCard(
		session,
		typeContract as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			reason: request.arguments.reason,
			attachEvents: true,
		},
		request.arguments.properties,
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

export const actionCreateCard: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-create-card',
		type: 'action@1.0.0',
		name: 'Create a new card',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				properties: {
					type: 'object',
					additionalProperties: false,
					properties: {
						id: {
							type: 'string',
							format: 'uuid',
						},
						version: {
							type: 'string',

							// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
							// eslint-disable-next-line max-len
							pattern:
								'^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$',
						},
						slug: {
							type: 'string',
							pattern: '^[a-z0-9-]+$',
						},
						name: {
							type: 'string',
						},
						active: {
							type: 'boolean',
						},
						created_at: {
							type: 'string',
							format: 'date-time',
						},
						updated_at: {
							anyOf: [
								{
									type: 'string',
									format: 'date-time',
								},
								{
									type: 'null',
								},
							],
						},
						markers: {
							type: 'array',
							items: {
								type: 'string',
								pattern: '^[a-zA-Z0-9-_/:+]+$',
							},
						},
						loop: {
							// TODO: Add pattern once the format of loop slugs has been finalized
							type: ['string', 'null'],
						},
						tags: {
							type: 'array',
							items: {
								type: 'string',
							},
						},
						links: {
							type: 'object',
						},
						data: {
							type: 'object',
						},
						requires: {
							type: 'array',
							items: {
								type: 'object',
							},
						},
						capabilities: {
							type: 'array',
							items: {
								type: 'object',
							},
						},
						linked_at: {
							type: 'object',
						},
					},
					required: [],
				},
			},
		},
	},
};
