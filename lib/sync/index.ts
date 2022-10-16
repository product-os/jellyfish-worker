import * as assert from '@balena/jellyfish-assert';
import type { LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import { strict } from 'assert';
import type { AutumnDBSession, Contract } from 'autumndb';
import _ from 'lodash';
import type { Map, WorkerContext } from '../types';
import * as errors from './errors';
import * as instance from './instance';
import * as oauth from './oauth';
import * as pipeline from './pipeline';
import { retryableContext } from './sync-action-context-retry-wrapper';
import * as syncContext from './sync-context';
import type {
	HttpRequestOptions,
	Integration,
	IntegrationDefinition,
	IntegrationInitializationOptions,
	SequenceItem,
} from './types';

export {
	errors,
	Integration,
	IntegrationDefinition,
	IntegrationInitializationOptions,
	HttpRequestOptions,
	oauth,
	SequenceItem,
};

/**
 * Jellyfish sync library module.
 *
 * @module sync
 */

interface SyncOptions {
	integrations?: Map<IntegrationDefinition>;
}

export class Sync {
	integrations: Map<IntegrationDefinition>;
	errors: typeof errors;
	pipeline: typeof pipeline;

	constructor(options: SyncOptions = {}) {
		this.integrations = options.integrations || {};
		this.errors = errors;
		this.pipeline = pipeline;
	}

	/**
	 * @summary Gets external user
	 * @function
	 * @public
	 *
	 * @param {Object} syncActionContext - sync action context
	 * @param {String} name - integration name
	 * @param {String} credentials - access token for external provider api
	 * @returns {Object} external user
	 */
	async whoami(
		syncActionContext: syncContext.SyncActionContext,
		name: string,
		credentials: any,
	) {
		const integration = this.integrations[name];

		assert.INTERNAL(
			syncActionContext,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			syncActionContext,
			!!integration.whoami,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a whoami() function`,
		);

		strict.ok(integration.whoami);
		return integration.whoami(syncActionContext, credentials);
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
		context: syncContext.SyncActionContext,
		name: string,
		externalUser: any,
		options: {
			slug: string;
		},
	) {
		const integration = this.integrations[name];

		assert.INTERNAL(
			context,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			context,
			!!integration.match,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a match() function`,
		);

		strict.ok(integration.match);
		const user = await integration.match(context, externalUser, {
			slug: options.slug,
		});

		if (user) {
			assert.INTERNAL(
				context,
				`${user.slug}@${user.version}` === options.slug,
				errors.SyncNoMatchingUser,
				`Could not find matching user for provider: ${name}, slugs do not match ${user.slug}@${user.version} !== ${options.slug}`,
			);
		}

		return user;
	}

	async getExternalUserSyncEventData(
		logContext: LogContext,
		name: string,
		externalUser: any,
	) {
		const integration = this.integrations[name];

		assert.INTERNAL(
			logContext,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			logContext,
			!!integration.getExternalUserSyncEventData,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a getExternalUserSyncEventData() function`,
		);

		strict.ok(integration.getExternalUserSyncEventData);
		const event = await integration.getExternalUserSyncEventData(
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
	 * @param name - integration name
	 * @param userContract - user to associate external token to
	 * @param credentials - external provider's api token
	 * @param context - sync action context
	 * @returns upserted user contract
	 */
	async associate(
		name: string,
		userContract: Contract,
		credentials: any,
		context: syncContext.SyncActionContext,
	) {
		const integration = this.integrations[name];

		assert.INTERNAL(
			context,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration: ${name}`,
		);

		/*
		 * Set the access token in the user contract.
		 */
		_.set(userContract, ['data', 'oauth', name], credentials);
		return context.upsertElement(
			userContract.type,
			_.omit(userContract, ['type']),
			{
				timestamp: new Date(),
			},
		);
	}

	/**
	 * @summary Check if an external event request is valid
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param name - integration name
	 * @param token - token details
	 * @param event - event
	 * @param event.raw - raw event payload
	 * @param event.headers - request headers
	 * @returns whether the external event should be accepted or not
	 */
	async isValidEvent(
		logContext: LogContext,
		name: string,
		token: any,
		event: {
			raw: any;
			headers: any;
		},
	) {
		const integration = this.integrations[name];
		if (!integration) {
			return false;
		}

		return integration.isEventValid(
			logContext,
			token,
			event.raw,
			event.headers,
		);
	}

	/**
	 * @summary Mirror back a contract insert coming from Jellyfish
	 * @function
	 * @public
	 *
	 * @param name - integration name
	 * @param token - token details
	 * @param contract - action target contract
	 * @param context - sync action context
	 * @param options - options object
	 * @param options.actor - actor id
	 * @param options.origin - oauth origin url
	 * @param options.defaultUser - default user id
	 * @returns inserted contracts
	 */
	async mirror(
		name: string,
		token: any,
		contract: Contract,
		context: syncContext.SyncActionContext,
		options: {
			actor: string;
			origin: string;
			defaultUser: string;
		},
	) {
		if (!token) {
			context.log.warn('Ignoring mirror as there is no token', {
				integration: name,
			});

			return [];
		}

		const integration = this.integrations[name];
		if (!integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return [];
		}

		return pipeline.mirrorCard(integration, contract, {
			actor: options.actor,
			defaultUser: options.defaultUser,
			token,
			context,
		});
	}

	/**
	 * @summary Translate an external event into Jellyfish
	 * @function
	 * @public
	 *
	 * @param name - integration name
	 * @param token - token details
	 * @param contract - action target contract
	 * @param context - execution context
	 * @param options - options
	 * @param options.actor - actor id
	 * @param options.defaultUser - default user id
	 * @param options.origin - oauth origin url
	 * @returns inserted contracts
	 */
	async translate(
		name: string,
		token: string,
		contract: Contract,
		context: syncContext.SyncActionContext,
		options: {
			actor: string;
			defaultUser: string;
			origin: string;
		},
	) {
		if (!token) {
			context.log.warn('Ignoring translate as there is no token', {
				integration: name,
			});

			return [];
		}

		const integration = this.integrations[name];
		if (!integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return [];
		}

		context.log.info('Translating external event', {
			id: contract.id,
			slug: contract.slug,
			integration: name,
		});

		const contracts = await metrics.measureTranslate(name, async () => {
			return pipeline.translateExternalEvent(integration, contract, {
				actor: options.actor,
				defaultUser: options.defaultUser,
				token,
				context,
			});
		});

		context.log.info('Translated external event', {
			slugs: contracts.map((translatedContract) => {
				return translatedContract.slug;
			}),
		});

		return contracts;
	}

	/**
	 * @summary Fetch a file synced in an external service
	 * @function
	 * @public
	 *
	 * @param name - integration name
	 * @param token - token details
	 * @param file - file id
	 * @param context - sync action context
	 * @param options - options object
	 * @param options.actor - actor id
	 * @returns file
	 */
	async getFile(
		name: string,
		token: any,
		file: string,
		context: syncContext.SyncActionContext,
		options: {
			actor: string;
		},
	): Promise<Buffer | null> {
		if (!token) {
			context.log.warn('Not fetching file as there is no token', {
				integration: name,
			});

			return null;
		}

		const integration = this.integrations[name];
		if (!integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration: name,
				},
			);

			return null;
		}

		context.log.info('Retrieving external file', {
			file,
			integration: name,
		});

		// TS-TODO: Its unclear if the origin and defaultUser options are required
		return instance.run(
			integration,
			token,
			async (integrationInstance) => {
				if (!integrationInstance.getFile) {
					context.log.warn(
						'Not fetching file as the integration does not support this feature',
						{
							integration: name,
						},
					);

					return null;
				}

				return integrationInstance.getFile(file);
			},
			{
				actor: options.actor,
				defaultUser: '',
				context,
			},
		);
	}

	// eslint-disable-next-line class-methods-use-this
	getActionContext(
		provider: string,
		workerContext: WorkerContext,
		context: any,
		session: AutumnDBSession,
	) {
		return retryableContext(
			syncContext.getActionContext(provider, workerContext, context, session),
		);
	}
}
