import type { ActionDefinition } from '../';

const handler: ActionDefinition['handler'] = async (
	_session,
	context,
	card,
	request,
) => {
	return context.sync.associate(
		request.arguments.provider,
		card,
		request.arguments.credentials,

		// We need privileged access in order to add the access
		// token data to the user, as the request that will
		// initiate this action is the external service when
		// posting us back the temporart access code.
		context.sync.getActionContext(
			request.arguments.provider,
			context,
			request.logContext,
			context.privilegedSession,
		),
	);
};

export const actionOAuthAssociate: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-oauth-associate',
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
				credentials: {
					type: 'object',
					properties: {
						access_token: {
							type: 'string',
						},
						token_type: {
							type: 'string',
						},
					},
					required: ['access_token', 'token_type'],
				},
			},
		},
	},
};
