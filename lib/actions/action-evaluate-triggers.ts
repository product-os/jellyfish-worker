import { getLogger } from '@balena/jellyfish-logger';
import type { ActionDefinition } from '../plugin';
import _ from 'lodash';

const logger = getLogger(__filename);

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	logger.debug(
		request.logContext,
		`action-evaluate-triggers handler ${session} ${context} ${card} ${request}`,
		{},
	);
	await context.executeAsyncTriggers(
		request.arguments.currentContract,
		request.arguments.insertedContract,
		request.arguments.options,
		request.arguments.currentTime,
		request.arguments.session,
	);

	return null;
};

export const actionEvaluateTriggers: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-evaluate-triggers',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Evaluate triggers',
		data: {
			arguments: {
				session: {
					type: 'string',
				},
				currentTime: {
					type: 'string',
				},
				currentContract: {
					anyOf: [
						{
							type: 'object',
						},
						{
							type: 'null',
						},
					],
				},
				insertedContract: {
					type: 'object',
				},
				options: {
					type: 'object',
					properties: {
						actor: {
							type: ['string', 'null'],
						},
						originator: {
							type: ['string', 'null'],
						},
						attachEvents: {
							type: 'boolean',
						},
						timestamp: {
							type: ['string', 'null'],
						},
						reason: {
							type: ['string', 'null'],
						},
						eventType: {
							type: ['object', 'string', 'null'],
						},
						eventPayload: {
							type: ['object', 'array', 'number', 'string', 'null'],
						},
					},
				},
			},
		},
	},
};
