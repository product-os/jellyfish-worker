import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import type { ContractSummary } from 'autumndb';
import type { ActionDefinition } from '../plugin';

const logger = getLogger(__filename);

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const cards = await context.sync
		.translate(
			card.data.source,
			defaultEnvironment.getIntegration(card.data.source as string),
			card,
			context.sync.getActionContext(
				card.data.source,
				context,
				request.logContext,
				session,
			),
			{
				actor: request.actor,
				defaultUser: defaultEnvironment.integration.default.user,
				origin: `${defaultEnvironment.oauth.redirectBaseUrl}/oauth/${card.data.source}`,
				timestamp: request.timestamp,
			},
		)
		.catch((error: unknown) => {
			const properError =
				error instanceof Error ? error : new Error(`${error}`);
			logger.exception(request.logContext, 'Translate error', properError);
			throw error;
		});

	return cards.map((element: ContractSummary) => {
		return {
			id: element.id,
			type: element.type,
			version: element.version,
			slug: element.slug,
		};
	});
};

export const actionIntegrationImportEvent: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-integration-import-event',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: '',
		data: {
			filter: {
				type: 'object',
				required: ['type', 'data'],
				properties: {
					type: {
						type: 'string',
						const: 'external-event@1.0.0',
					},
					data: {
						type: 'object',
						required: ['source'],
						properties: {
							source: {
								type: 'string',
							},
						},
					},
				},
			},
			arguments: {},
		},
	},
};
