import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import type { AutumnDBSession, ContractSummary } from 'autumndb';
import type { ActionHandlerRequest, WorkerContext } from '../types';

const logger = getLogger(__filename);

const mirror = async (
	type: string,
	session: AutumnDBSession,
	context: WorkerContext,
	card: ContractSummary,
	request: ActionHandlerRequest,
) => {
	// Don't sync back changes that came externally
	if (request.originator) {
		const originator = await context.getCardById(
			context.privilegedSession,
			request.originator,
		);
		if (
			originator &&
			originator.type &&
			originator.type.split('@')[0] === 'external-event' &&
			// Only break the chain if we are trying to mirror
			// an external event that came from that same service
			originator.data.source === type
		) {
			logger.info(request.logContext, 'Not mirroring external event', {
				type,
				request,
			});

			return [];
		}
	}

	try {
		const cards = await context.sync.mirror(
			type,
			defaultEnvironment.getIntegration(type),
			card,
			context.sync.getActionContext(type, context, request.logContext, session),
			{
				actor: request.actor,
				defaultUser: defaultEnvironment.integration.default.user,
				origin: `${defaultEnvironment.oauth.redirectBaseUrl}/oauth/${type}`,
			},
		);

		return cards.map((element: ContractSummary) => {
			return {
				id: element.id,
				type: element.type,
				version: element.version,
				slug: element.slug,
			};
		});
	} catch (error: any) {
		logger.exception(request.logContext, 'Mirror error', error);
		throw error;
	}
};

export { mirror };
