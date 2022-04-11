import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import type { JsonSchema } from '@balena/jellyfish-types';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import * as skhema from 'skhema';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';

const logger = getLogger(__filename);

const defaultWorkerFilter = {
	type: 'object',
	required: ['type'],
	properties: {
		type: {
			const: 'transformer-worker@1.0.0',
		},
		data: {
			type: 'object',
			properties: {
				canary: {
					not: {
						const: true,
					},
				},
			},
		},
	},
};

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = context.cards[card.type];

	assert.USER(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const result = {
		id: card.id,
		type: card.type,
		version: card.version,
		slug: card.slug,
	};

	let matcher = _.get(card, ['data', 'workerFilter', 'schema']);

	if (!matcher) {
		logger.warn(request.logContext, 'Task has no worker filter', {
			id: card.id,
			slug: card.slug,
			type: card.type,
		});
		matcher = defaultWorkerFilter;
	}

	// the privileged session would allow querying for deleted contracts and
	// we currently have no worker cleanup implemented
	const workerMaxAge = 10 * 60 * 1000;
	const safeWorkerQuery = skhema.merge([
		matcher,
		{
			type: 'object',
			required: ['active', 'updated_at'],
			properties: {
				active: {
					const: true,
				},
				updated_at: {
					type: 'string',
					format: 'date-time',
					formatMinimum: new Date(
						new Date().getTime() - workerMaxAge,
					).toISOString(),
				},
			},
		},
	]);
	// Find all the agents that match the task
	const workers = await context.query(
		context.privilegedSession,
		safeWorkerQuery as JsonSchema,
	);

	// Sort the agents by the best match
	const [bestMatchedWorker] = _.reverse(
		_.sortBy(workers, (item) => {
			return skhema.scoreMatch(safeWorkerQuery, item);
		}),
	);

	if (!bestMatchedWorker) {
		logger.warn(
			request.logContext,
			'Could not find a matching worker for task',
			{
				id: card.id,
				slug: card.slug,
				type: card.type,
			},
		);
		return result;
	}
	// Assign the task to the agent
	const linkTypeCard = context.cards['link@1.0.0'];
	assert.INTERNAL(
		request.logContext,
		linkTypeCard,
		errors.WorkerNoElement,
		'No such type: link',
	);

	await context.insertCard(
		session,
		linkTypeCard as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'owns',
			data: {
				inverseName: 'is owned by',
				from: {
					id: bestMatchedWorker.id,
					type: bestMatchedWorker.type,
				},
				to: {
					id: card.id,
					type: card.type,
				},
			},
		},
	);

	return result;
};

export const actionMatchMakeTask: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-matchmake-task',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Matchmake task to agent',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'task@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {},
		},
	},
};
