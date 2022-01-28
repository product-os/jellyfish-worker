import * as assert from '@balena/jellyfish-assert';
import type { LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import type { Contract } from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import Bluebird from 'bluebird';
import _ from 'lodash';
import type { Map } from '../types';
import * as errors from './errors';
import * as oauth from './oauth';
import { getIntegrationExecutionContext } from './context';
import type { SyncActionContext } from './context';
import {
	Integration,
	IntegrationDefinition,
	IntegrationExecutionOptions,
	IntegrationExecutionResult,
} from './types';
import * as utils from './utils';
export { Integration, IntegrationDefinition };

/**
 * Jellyfish sync library module.
 *
 * @module sync
 */

interface SyncOptions {
	integrationsDefinitions?: Map<IntegrationDefinition>;
}

export class Sync {
	integrationDefinitions: Map<IntegrationDefinition>;
	errors: typeof errors;

	constructor(options: SyncOptions = {}) {
		this.integrationDefinitions = options.integrationsDefinitions || {};
		this.errors = errors;
	}

	/**
	 * @summary Get an external authorize URL
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {String} slug - user slug
	 * @param {Object} options - options
	 * @param {String} options.origin - The callback URL
	 * @returns {String} Authorize URL
	 */
	getAssociateUrl(
		name: string,
		token: any,
		slug: string,
		options: { origin: string },
	) {
		const integration = this.integrationDefinitions[name];
		if (
			!integration ||
			!token ||
			!token.appId ||
			!integration.OAUTH_BASE_URL ||
			!integration.OAUTH_SCOPES
		) {
			return null;
		}

		return oauth.getAuthorizeUrl(
			integration.OAUTH_BASE_URL,
			integration.OAUTH_SCOPES,
			slug,
			{
				appId: token.appId,
				redirectUri: options.origin,
			},
		);
	}

	/**
	 * @summary Authorize a user with an external OAuth service
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.code - short lived OAuth code
	 * @param {String} options.origin - The callback URL
	 * @returns {Object} external provider's access token
	 */
	async authorize(
		name: string,
		token: any,
		context: SyncActionContext,
		options: {
			code: string;
			origin: string;
		},
	) {
		const integration = this.integrationDefinitions[name];

		assert.INTERNAL(
			context,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			context,
			token && token.appId && token.appSecret,
			errors.SyncNoIntegrationAppCredentials,
			`No application credentials found for integration: ${name}`,
		);

		return oauth.getAccessToken(integration.OAUTH_BASE_URL, options.code, {
			appId: token.appId,
			appSecret: token.appSecret,
			redirectUri: options.origin,
		});
	}

	/**
	 * @summary Gets external user
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {String} name - integration name
	 * @param {String} credentials - access token for external provider api
	 * @returns {Object} external user
	 */
	async whoami(context: SyncActionContext, name: string, credentials: any) {
		const integration = this.integrationDefinitions[name];

		assert.INTERNAL(
			context,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			context,
			!!integration.whoami,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a whoami() function`,
		);

		strict.ok(integration.whoami);
		return integration.whoami(context, credentials);
	}

	/**
	 * @summary Gets local user matching the external user
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {String} name - integration name
	 * @param {Object} externalUser - external user
	 * @param {Object} options - options
	 * @param {String} options.slug - slug to be used as a fallback to get a user
	 * @returns {Object} external user
	 */
	async match(
		context: SyncActionContext,
		name: string,
		externalUser: any,
		options: {
			slug: string;
		},
	) {
		const integrationDefinition = this.integrationDefinitions[name];

		assert.INTERNAL(
			context,
			!!integrationDefinition,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			context,
			!!integrationDefinition.match,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a match() function`,
		);

		strict.ok(integrationDefinition.match);
		const user = await integrationDefinition.match(context, externalUser, {
			slug: `${options.slug}@latest`,
		});

		if (user) {
			assert.INTERNAL(
				context,
				user.slug === options.slug,
				errors.SyncNoMatchingUser,
				`Could not find matching user for provider: ${name}, slugs do not match ${user.slug} !== ${options.slug}`,
			);
		}

		return user;
	}

	async getExternalUserSyncEventData(
		logContext: LogContext,
		name: string,
		externalUser: any,
	) {
		const integrationDefinition = this.integrationDefinitions[name];

		assert.INTERNAL(
			logContext,
			!!integrationDefinition,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			logContext,
			!!integrationDefinition.getExternalUserSyncEventData,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a getExternalUserSyncEventData() function`,
		);

		strict.ok(integrationDefinition.getExternalUserSyncEventData);
		const event = await integrationDefinition.getExternalUserSyncEventData(
			logContext,
			externalUser,
		);

		assert.INTERNAL(
			logContext,
			event,
			errors.SyncNoMatchingUser,
			'Could not generate external user sync event',
		);

		return event;
	}

	/**
	 * @summary Associate a user with an external OAuth service
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} userCard - user to associate external token to
	 * @param {Object} credentials - external provider's api token
	 * @param {Object} context - execution context
	 * @returns {Object} Upserted user card
	 */
	async associate(
		name: string,
		userCard: Contract,
		credentials: any,
		context: SyncActionContext,
	) {
		const integrationDefinition = this.integrationDefinitions[name];

		assert.INTERNAL(
			context,
			!!integrationDefinition,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration: ${name}`,
		);

		/*
		 * Set the access token in the user card.
		 */
		_.set(userCard, ['data', 'oauth', name], credentials);
		return context.upsertElement(userCard.type, _.omit(userCard, ['type']), {
			timestamp: new Date(),
		});
	}

	/**
	 * @summary Check if an external event request is valid
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {Object} event - event
	 * @param {String} event.raw - raw event payload
	 * @param {Object} event.headers - request headers
	 * @param {Object} context - logger context
	 * @returns {Boolean} whether the external event should be accepted or not
	 */
	async isValidEvent(
		logContext: LogContext,
		name: string,
		token: any,
		event: any,
	) {
		const integrationDefinition = this.integrationDefinitions[name];
		if (!integrationDefinition || !token) {
			return false;
		}

		return integrationDefinition.isEventValid(
			logContext,
			token,
			event.raw,
			event.headers,
		);
	}

	/**
	 * @summary Mirror back a card insert coming from Jellyfish
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {Object} card - action target card
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @param {String} [options.origin] - OAuth origin URL
	 * @returns {Object[]} inserted cards
	 */
	async mirror(
		name: string,
		token: any,
		contract: Contract,
		context: SyncActionContext,
		options: {
			actor: string;
			origin: string;
			defaultUser: string;
		},
	) {
		if (!token) {
			context.logger.warn('Ignoring mirror as there is no token', {
				integration: name,
			});

			return [];
		}

		const integrationDefinition = this.integrationDefinitions[name];
		if (!integrationDefinition) {
			context.logger.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return [];
		}

		const contracts = await metrics.measureMirror(name, async () => {
			return this.executeIntegrationAndImportResultsAsContracts(
				integrationDefinition,
				{
					syncActionContext: context,
					token,
					provider: name,
					actor: options.actor,
					origin: options.origin,
					defaultUser: options.defaultUser,
				},
				'mirror',
				contract,
			);
		});

		context.logger.info('Mirrored external event', {
			slugs: contracts.map((mirroredContract) => {
				return mirroredContract.slug;
			}),
		});

		return contracts;
	}

	executeIntegration = async (
		integrationDefinition: IntegrationDefinition,
		options: IntegrationExecutionOptions,
		fn: 'translate' | 'mirror',
		contract: Contract,
	): Promise<IntegrationExecutionResult[]> => {
		const integration = await integrationDefinition.initialize({
			token: options.token,
			defaultUser: options.defaultUser,
			context: getIntegrationExecutionContext(integrationDefinition, options),
		});

		let results: IntegrationExecutionResult[] = [];

		try {
			results = await integration[fn](contract, {
				actor: options.actor,
			});

			options.syncActionContext.logger.debug('Integration execution results:', {
				type: fn,
				results,
			});
		} catch (error) {
			throw error;
		} finally {
			await integration.destroy();
		}

		return results;
	};

	executeIntegrationAndImportResultsAsContracts = async (
		integrationDefinition: IntegrationDefinition,
		options: IntegrationExecutionOptions,
		fn: 'translate' | 'mirror',
		contract: Contract,
	): Promise<Contract[]> => {
		try {
			const results = await this.executeIntegration(
				integrationDefinition,
				options,
				fn,
				contract,
			);

			options.syncActionContext.logger.debug(
				'Importing integration execution results as contracts:',
				{
					type: fn,
					results,
				},
			);

			console.warn(
				'==> results obtained by executeIntegrationAndImportResultsAsContracts',
				results,
			);

			const contracts = this.importIntegrationExecutionResultsAsContracts(
				options.syncActionContext,
				results,
				{
					origin: contract,
				},
			);

			return contracts;
		} catch (error) {
			throw error;
		}
	};

	/**
	 * @summary Save integration execution results as contracts
	 * @function
	 * @public
	 *
	 * @param {Object} context - worker execution context
	 * @param {Array} sequence - contract sequence
	 * @param {Object} options - options
	 * @param {String} options.origin - origin id
	 * @returns {Contract[]} inserted contracts
	 *
	 * @example
	 * const result = await sync.importIntegrationExecutionResultsAsContracts({ ... }, [
	 *   {
	 *     time: new Date(),
	 *     contract: { ... }
	 *   },
	 *   {
	 *     time: new Date(),
	 *     contract: { ... }
	 *   },
	 *   {
	 *     time: new Date(),
	 *     contract: { ... }
	 *   }
	 * ], {
	 *   origin: 'e9b74e2a-3553-4188-8ab8-a67e92aedbe2'
	 * })
	 */
	importIntegrationExecutionResultsAsContracts = async (
		context: SyncActionContext,
		results: Array<IntegrationExecutionResult | IntegrationExecutionResult[]>,
		options: {
			references?: any;
			origin?: Contract;
		} = {},
	) => {
		// TODO: AFAICT the references option is never
		// provided and can probably be removed.
		const references = options.references || {};
		const insertedContracts: Contract[] = [];

		for (const [index, value] of results.entries()) {
			const step = _.castArray(value);
			await Bluebird.map(
				step,
				async (result, subindex, length) => {
					const path = ['cards', index];
					if (length !== 1) {
						path.push(subindex);
					}

					let object = {};
					let finalObject: Partial<Contract> = {};
					const type = result.contract.type;

					// Check if this is a JSONpatch or a slug-based upsert
					if ('patch' in result.contract) {
						// If the patch doesn't update the origin, add it now
						if (
							!_.find(result.contract.patch, {
								path: '/data/origin',
							})
						) {
							if (
								options.origin &&
								options.origin.type === 'external-event@1.0.0'
							) {
								result.contract.patch.push({
									op: 'add',
									path: '/data/origin',
									value: `${options.origin.slug}@${options.origin.version}`,
								});
							}
						}
						finalObject = utils.evaluateObjectWithContext(
							_.omit(result.contract, ['links']),
							references,
						);
					} else {
						object = utils.evaluateObjectWithContext(
							_.omit(result.contract, ['links']),
							references,
						);
						assert.INTERNAL(
							context,
							!!object,
							errors.SyncInvalidTemplate,
							() =>
								`Could not evaluate template in: ${JSON.stringify(
									result.contract,
									null,
									2,
								)}`,
						);

						finalObject = Object.assign(
							{
								active: true,
								version: '1.0.0',
								tags: [],
								markers: [],
								links: {},
								requires: [],
								capabilities: [],
								data: {},
							},
							object,
						);

						if (
							options.origin &&
							options.origin.type === 'external-event@1.0.0' &&
							!result.skipOriginator
						) {
							finalObject.data!.origin = `${options.origin.slug}@${options.origin.version}`;
						}
					}

					assert.INTERNAL(
						context,
						!!result.actor,
						errors.SyncNoActor,
						() => `No actor in result: ${JSON.stringify(result)}`,
					);

					const contract = await context.upsertElement(type, finalObject, {
						timestamp: result.time,
						actor: result.actor,
						originator: result.skipOriginator
							? null
							: _.get(options, ['origin', 'id']),
					});

					if (contract) {
						insertedContracts.push(contract);
					}

					_.set(references, path, contract);
				},
				{
					concurrency: 3,
				},
			);
		}

		return insertedContracts;
	};

	/**
	 * @summary Translate an external event into Jellyfish
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {Object} contract - action target contract
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @param {String} options.timestamp - timestamp
	 * @param {String} [options.origin] - OAuth origin URL
	 * @returns {Object[]} inserted cards
	 */
	translate = async (
		name: string,
		token: string,
		contract: Contract,
		context: SyncActionContext,
		options: {
			actor: string;
			defaultUser: string;
			origin: string;
		},
	) => {
		if (!token) {
			context.logger.warn('Ignoring translate as there is no token', {
				integration: name,
			});

			return [];
		}

		const integrationDefinition = this.integrationDefinitions[name];
		if (!integrationDefinition) {
			context.logger.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return [];
		}

		context.logger.info('Translating external event', {
			id: contract.id,
			slug: contract.slug,
			integration: name,
		});

		const contracts = await metrics.measureTranslate(name, async () => {
			return this.executeIntegrationAndImportResultsAsContracts(
				integrationDefinition,
				{
					token,
					actor: options.actor,
					origin: options.origin,
					defaultUser: options.defaultUser,
					provider: name,
					syncActionContext: context,
				},
				'translate',
				contract,
			);
		});

		context.logger.info('Translated external event', {
			slugs: contracts.map((translatedCard) => {
				return translatedCard.slug;
			}),
		});

		return contracts;
	};

	/**
	 * @summary Fetch a file synced in an external service
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {String} file - file id
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @returns {Buffer} file
	 */
	async getFile(
		name: string,
		token: any,
		file: string,
		context: SyncActionContext,
		options: {
			actor: string;
		},
	): Promise<Buffer | null> {
		if (!token) {
			context.logger.warn('Not fetching file due to missing token', {
				integration: name,
			});
			return null;
		}

		const integrationDefinition = this.integrationDefinitions[name];
		if (!integrationDefinition) {
			context.logger.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return null;
		}

		const integration = await integrationDefinition.initialize({
			token,
			defaultUser: '',
			context: getIntegrationExecutionContext(integrationDefinition, {
				token,
				actor: options.actor,
				provider: name,
				origin: '',
				defaultUser: '',
				syncActionContext: context,
			}),
		});

		context.logger.info('Retrieving external file', {
			file,
			integration: name,
		});

		try {
			if (!integration.getFile) {
				context.logger.warn(
					'Not fetching file as the integration does not support this feature',
					{
						integration: name,
					},
				);
				return null;
			}
			return integration.getFile(file);
		} catch (error) {
			await integration.destroy();
			throw error;
		}
	}
}
