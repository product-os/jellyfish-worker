import { getLogger } from '@balena/jellyfish-logger';
import { strict as assert } from 'assert';
import type { TypeContract } from 'autumndb';
import _ from 'lodash';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';

const logger = getLogger(__filename);

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	contract,
	request,
) => {
	const result = {
		id: contract.id,
		type: contract.type,
		version: contract.version,
		slug: contract.slug,
	};

	// Do nothing of contract is already owned by someone
	const contractWithOwnerLinks = await context.query(
		context.privilegedSession,
		{
			type: 'object',
			properties: {
				id: {
					const: contract.id,
				},
			},
			$$links: {
				'is owned by': {
					type: 'object',
				},
			},
		},
	);
	if (contractWithOwnerLinks[0]) {
		console.log('Not attempting matchmake, contract already owned');
		logger.debug(
			request.logContext,
			'Not attempting matchmake, contract already owned',
			{
				contract: contract.id,
				source: request.arguments.source,
			},
		);
		return result;
	}

	// Assert that the source contract exists
	const source = await context.getCardById(
		context.privilegedSession,
		request.arguments.source,
	);
	assert(
		source,
		new errors.WorkerNoElement(
			`Source contract not found: ${request.arguments.source}`,
		),
	);

	// Get agents with their working hours and channel settings if source is a channel
	const agents = await context.query(context.privilegedSession, {
		type: 'object',
		required: ['id'],
		properties: {
			id: {
				type: 'string',
				const: source.id,
			},
		},
		$$links: {
			'has agent': {
				type: 'object',
				required: ['active', 'type'],
				properties: {
					active: {
						type: 'boolean',
						const: true,
					},
					type: {
						type: 'string',
						enum: ['transformer-worker@1.0.0', 'user@1.0.0'],
					},
				},
				$$links: {
					'has settings': {
						type: 'object',
						required: ['active', 'type'],
						properties: {
							active: {
								type: 'boolean',
								const: true,
							},
							type: {
								type: 'string',
								enum: ['working-hours@1.0.0', 'agent-settings@1.0.0'],
							},
						},
					},
				},
			},
		},
	});

	if (agents.length > 0 && agents[0].links && agents[0].links['has agent']) {
        // Send whisper using bot user to create notification for selected agent
        const agent = agents[0].links['has agent'][0];
		const typeContract = context.cards['action-request@1.0.0'] as TypeContract;
		const date = new Date();
		await context.insertCard(
		    context.privilegedSession,
			typeContract,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			{
				data: {
					actor: request.actor,
					context: request.logContext,
					action: 'action-create-event@1.0.0',
					card: contract.id,
					type: contract.type,
					epoch: date.valueOf(),
					timestamp: date.toISOString(),
					input: {
						id: contract.id,
					},
					arguments: {
						type: 'whisper',
						payload: {
							message: `@${agent.slug.replace(
								'user-',
								'',
							)} - You have been chosen, take ownership if possible!`,
						},
					},
				},
			},
		);
	} else {
		console.log('Not attempting matchmake, no agents found');
		logger.debug(
			request.logContext,
			'Not attempting matchmake, no agents found',
			{
				contract: contract.id,
				source: request.arguments.source,
			},
		);
		return result;
	}

	return result;
};

export const actionMatchMake: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-matchmake',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Matchmake contract to agent',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {
				source: {
					type: 'string',
					format: 'uuid',
				},
			},
		},
	},
};
