import type { TypeContract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import type { ActionDefinition } from '../plugin';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	const current = _.get(contract, request.arguments.property);
	const source = _.clone(current) || [];
	const initialLength = source.length;
	const input = _.isArray(request.arguments.value)
		? request.arguments.value
		: [request.arguments.value];

	for (const element of input) {
		if (!_.includes(source, element)) {
			source.push(element);
		}
	}

	if (initialLength === source.length) {
		return {
			id: contract.id,
			type: contract.type,
			version: contract.version,
			slug: contract.slug,
		};
	}

	const typeContract = (await context.getCardBySlug(
		session,
		contract.type,
	))! as TypeContract;

	const path = _.isString(request.arguments.property)
		? `/${request.arguments.property.replace(/\./g, '/')}`
		: `/${request.arguments.property.join('/')}`;

	const result = await context.patchCard(
		session,
		typeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		contract,
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
		version: '1.0.0',
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
