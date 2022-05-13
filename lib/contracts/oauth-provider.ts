import {
	Contract,
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';

export interface OauthProviderContractData extends ContractData {
	authorizeUrl: string;
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
	integration: string;
}

export type OauthProviderContract = Contract<OauthProviderContractData>;

export const oauthProvider: ContractDefinition = {
	slug: 'oauth-provider',
	type: 'type@1.0.0',
	name: 'Oauth Provider',
	data: {
		schema: {
			type: 'object',
			properties: {
				slug: {
					type: 'string',
					pattern: '^oauth-provider-[a-z0-9-]+$',
				},
				name: {
					type: 'string',
				},
				data: {
					type: 'object',
					required: [
						'authorizeUrl',
						'tokenUrl',
						'clientId',
						'clientSecret',
						'integration',
					],
					properties: {
						authorizeUrl: {
							type: 'string',
						},
						tokenUrl: {
							type: 'string',
						},
						clientId: {
							type: 'string',
						},
						clientSecret: {
							type: 'string',
						},
						integration: {
							type: 'string',
						},
					},
				},
			},
		},
	},
};
