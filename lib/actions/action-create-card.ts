import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from 'autumndb';
import skhema from 'skhema';
import type { ActionDefinition } from '../plugin';
import * as errors from '../errors';

interface LinkTarget {
	name: string;
	inverseName: string;
	to: {
		id: string;
		type: string;
	};
}

interface Links {
	[key: string]: Array<{
		id: string;
		slug: string;
		type: string;
	}>;
}

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
		'You may not use contract actions to create an event',
	);

	// Validate links if set
	const linkTargets: LinkTarget[] = [];
	if (request.arguments.properties.links) {
		const from = typeContract.slug;
		const links: Links = request.arguments.properties.links;
		await Promise.all(
			(Object.keys(links) as string[]).map(async (name) => {
				for (const target of links[name]) {
					// Assert target contract exists
					const targetContract = await context.getCardById(session, target.id);
					if (!targetContract) {
						throw new errors.SyncNoElement(
							`Target contract ${target.id} does not exist`,
						);
					}

					// Assert relationship contract exists
					const to = target.type.split('@')[0];
					const [match] = context.relationships.filter((relationship) => {
						return (
							(relationship.name === name &&
								(relationship.data.from.type === from ||
									relationship.data.from.type === '*') &&
								(relationship.data.to.type === to ||
									relationship.data.to.type === '*')) ||
							(relationship.data.inverseName === name &&
								(relationship.data.from.type === to ||
									relationship.data.from.type === '*') &&
								(relationship.data.to.type === from ||
									relationship.data.to.type === '*'))
						);
					});
					if (!match) {
						throw new errors.SyncNoElement(
							`No relationship found for: ${from} ${name} ${to}`,
						);
					}

					// Everything necessary exists, add to link targets
					linkTargets.push({
						name: match.name === name ? name : match.data.inverseName,
						inverseName:
							match.data.inverseName === name
								? match.name!
								: match.data.inverseName,
						to: {
							id: target.id,
							type: target.type,
						},
					});
				}
			}),
		);
	}

	// Create contract
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

	// Create link(s) if necessary
	if (linkTargets.length > 0) {
		await Promise.all(
			linkTargets.map(async (linkTarget) => {
				await context.insertCard(
					session,
					context.cards['link@1.0.0'] as TypeContract,
					{},
					{
						type: 'link@1.0.0',
						name: linkTarget.name,
						data: {
							inverseName: linkTarget.inverseName,
							from: {
								id: result.id,
								type: result.type,
							},
							to: {
								id: linkTarget.to.id,
								type: linkTarget.to.type,
							},
						},
					},
				);
			}),
		);
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
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Create a new contract',
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
