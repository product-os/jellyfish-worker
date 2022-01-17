import type { ActionDefinition } from '../plugin';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import { clone, get, includes, isArray, isString } from 'lodash';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const current = get(card, request.arguments.property);
	const source = clone(current) || [];
	const initialLength = source.length;
	const input = isArray(request.arguments.value)
		? request.arguments.value
		: [request.arguments.value];

	for (const element of input) {
		if (!includes(source, element)) {
			source.push(element);
		}
	}

	if (initialLength === source.length) {
		return {
			id: card.id,
			type: card.type,
			version: card.version,
			slug: card.slug,
		};
	}

	const typeCard = (await context.getCardBySlug(
		session,
		card.type,
	))! as TypeContract;

	const path = isString(request.arguments.property)
		? `/${request.arguments.property.replace(/\./g, '/')}`
		: `/${request.arguments.property.join('/')}`;

	const result = await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		[
			{
				op: current ? 'replace' : 'add',
				path,
				value: source,
			},
		],
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

export const actionSetAdd: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-set-add',
		type: 'action@1.0.0',
		name: 'Add an element to a set',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {
				property: {
					type: 'string',
				},
				value: {
					type: ['string', 'number', 'array'],
				},
			},
		},
	},
};
