import type { ActionDefinition, OauthProviderContract } from '../';
import { getAccessToken } from '../sync/oauth';

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	_card,
	request,
) => {
	const provider = (await context.getCardBySlug(
		context.privilegedSession,
		request.arguments.provider,
	)) as any as OauthProviderContract | null;

	if (!provider) {
		throw new Error(
			`Provider with slug "${request.arguments.provider}" does not exist`,
		);
	}

	return getAccessToken(provider, request.arguments.code);
};

export const actionOAuthAuthorize: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-oauth-authorize',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: '',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				provider: {
					type: 'string',
				},
				code: {
					type: 'string',
				},
			},
		},
	},
};
