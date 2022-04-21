import * as assert from '@balena/jellyfish-assert';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { JsonSchema } from '@balena/jellyfish-types';
import type {
	ContractDefinition,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import _ from 'lodash';
import * as skhema from 'skhema';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';
import type { WorkerContext } from '../types';

const logger = getLogger(__filename);

// TODO: Store this in worker context in something like workerContext.matchMakeHandlers[]?
// Defined as the fallback default channel matchmake handler
async function defaultMakeMatchHandler(
	_workerContext: WorkerContext,
	_logContext: LogContext,
	_contract: ContractDefinition,
): Promise<ContractDefinition | null> {
	// Simple things to check that would make sense for all cases, a common demoninator handler.
	// Could check things like:
	// The number of contracts (tasks) owned by each agent
	// How recently each agent was assigned a contract

	return null;
}

// TODO: Store this in worker context in something like workerContext.matchMakeHandlers[]?
// Defined as part of the channel contract, like actions and their handlers.
async function transformerMatchMakeHandler(
	workerContext: WorkerContext,
	logContext: LogContext,
	contract: ContractDefinition,
): Promise<ContractDefinition | null> {
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

	let matcher = _.get(contract, ['data', 'workerFilter', 'schema']);
	if (!matcher) {
		logger.warn(logContext, 'Task has no worker filter', {
			id: contract.id,
			slug: contract.slug,
			type: contract.type,
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
	const workers = await workerContext.query(
		workerContext.privilegedSession,
		safeWorkerQuery as JsonSchema,
	);

	// Sort the agents by the best match
	const [bestMatchedWorker] = _.reverse(
		_.sortBy(workers, (item) => {
			return skhema.scoreMatch(safeWorkerQuery, item);
		}),
	);

	return bestMatchedWorker;
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	// 1. Assert valid contract type
	const typeCard = context.cards[contract.type];
	assert.USER(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		`No such type: ${contract.type}`,
	);

	const result = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};

	// 2. Assert contract is not already owned
	const owner = await context.query(context.privilegedSession, {
		type: 'object',
		$$links: {
			'is owner of': {
				type: 'object',
				required: ['id'],
				properties: {
					id: {
						type: 'string',
						const: contract.id,
					},
				},
			},
		},
	});
	if (owner && owner.length > 0) {
		logger.debug(
			request.logContext,
			'Contract already owned, skipping matchmake',
			{
				contract: {
					id: contract.id,
					type: contract.type,
				},
				owner: {
					id: owner[0].id,
					type: owner[0].type,
				},
			},
		);
		return result;
	}

	// 3. Get channel along with all agents and their preferences
	const channel = await context.query(context.privilegedSession, {
		type: 'object',
		required: ['id', 'type'],
		properties: {
			id: {
				type: 'string',
				const: request.arguments.channel,
			},
			type: {
				type: 'string',
				const: 'channel@1.0.0',
			},
		},
		anyOf: [
			{
				$$links: {
					'has agent': {
						type: 'object',
					},
				},
			},
			{
				$$links: {
					'has preference': {
						type: 'object',
					},
				},
			},
		],
	});
	strict(channel.length > 0);

	// TODO: Use function stored under context.matchMakeHandlers? (similar to action handlers)
	// Example: const candidate = await context.matchMakeHandlers[channel.data.matchmake.handler](...);
	const candidate = await transformerMatchMakeHandler(
		context,
		request.logContext,
		contract,
	);
	if (!candidate) {
		logger.warn(
			request.logContext,
			'Could not find a matching agent for task',
			{
				id: contract.id,
				slug: contract.slug,
				type: contract.type,
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
					id: candidate.id,
					type: candidate.type,
				},
				to: {
					id: contract.id,
					type: contract.type,
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
