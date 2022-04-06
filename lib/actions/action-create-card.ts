import * as assert from '@balena/jellyfish-assert';
import {
	getReverseConstraint,
	linkConstraints,
} from '@balena/jellyfish-client-sdk';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import _ from 'lodash';
import skhema from 'skhema';
import { WorkerNoElement } from '../errors';
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
		'You may not use contract actions to create an event',
	);

	// Prepare link targets if necessary
	const linkTargets: { [key: string]: Contract[] } = {};
	if (request.arguments.properties.links) {
		for (const [verb, links] of Object.entries(
			request.arguments.properties.links,
		)) {
			for (const link of links as any[]) {
				// Assert the link matches constraints
				// TODO: Add helper to client-sdk to do this?
				const predicate = {
					name: verb,
					data: {
						from: typeContract.slug,
						to: link.type,
					},
				};
				strict(
					_.find(linkConstraints, predicate),
					new Error(`Link constraint not found: ${JSON.stringify(predicate)}`),
				);

				// Assert the contract exists
				const contract = await context.getCardById(session, link.id);
				strict(
					contract,
					new WorkerNoElement(`Contract for link not found: ${link.id}`),
				);
				if (!linkTargets[verb]) {
					linkTargets[verb] = [];
				}
				linkTargets[verb].push(contract);
			}
		}
	}

	// Create new contract
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

	// Link contract(s) if necessary
	if (!_.isEmpty(linkTargets)) {
		const linkTypeContract = await context.getCardBySlug(session, 'link@1.0.0');
		strict(
			linkTypeContract,
			new WorkerNoElement('Link type contract not found'),
		);

		// TODO: Enqueue by inserting a action request (not yet implemented)
		for (const [verb, contracts] of Object.entries(linkTargets)) {
			for (const contract of contracts as any[]) {
				const reverse = getReverseConstraint(
					typeContract.slug,
					contract.type.split('@')[0],
					verb,
				);
				strict(reverse, new Error('Reverse constraint not found'));
				await context.insertCard(
					session,
					linkTypeContract as TypeContract,
					{},
					{
						slug: `link-${result.slug}-${verb.replace(/\s/g, '-')}-${
							contract.slug
						}`,
						type: `${linkTypeContract.slug}@${linkTypeContract.version}`,
						name: verb,
						data: {
							inverseName: reverse.name,
							from: {
								id: result.id,
								type: result.type,
							},
							to: {
								id: contract.id,
								type: contract.type,
							},
						},
					},
				);
			}
		}
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
