import * as assert from '@balena/jellyfish-assert';
import type { LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import type { Contract } from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import _ from 'lodash';
import type { Map, WorkerContext } from '../types';
import * as errors from './errors';
import * as instance from './instance';
import * as oauth from './oauth';
import * as pipeline from './pipeline';
import * as syncContext from './sync-context';
import type { Integration, IntegrationDefinition, SequenceItem } from './types';

export { errors, Integration, IntegrationDefinition, SequenceItem };

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
		const integration = this.integrations[name];
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
		context: syncContext.SyncActionContext,
		options: {
			code: string;
			origin: string;
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
	 * @param {Object} context - log context
	 * @param {String} name - integration name
	 * @param {String} credentials - access token for external provider api
	 * @returns {Object} external user
	 */
	async whoami(logContext: LogContext, name: string, credentials: any) {
		const integration = this.integrations[name];

		assert.INTERNAL(
			logContext,
			!!integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${name}`,
		);

		assert.INTERNAL(
			logContext,
			!!integration.whoami,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${name} does not provide a whoami() function`,
		);

		strict.ok(integration.whoami);
		return integration.whoami(logContext, credentials);
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
		const integration = this.integrations[name];
		if (!integration || !token) {
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
		card: Contract,
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

		return pipeline.mirrorCard(integration, card, {
			actor: options.actor,
			origin: options.origin,
			defaultUser: options.defaultUser,
			provider: name,
			token,
			context,
		});
	}

	/**
	 * @summary Translate an external event into Jellyfish
	 * @function
	 * @public
	 *
	 * @param {String} name - integration name
	 * @param {Object} token - token details
	 * @param {Object} card - action target card
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @param {String} options.timestamp - timestamp
	 * @param {String} [options.origin] - OAuth origin URL
	 * @returns {Object[]} inserted cards
	 */
	async translate(
		name: string,
		token: string,
		card: Contract,
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
			id: card.id,
			slug: card.slug,
			integration: name,
		});

		const cards = await metrics.measureTranslate(name, async () => {
			return pipeline.translateExternalEvent(integration, card, {
				actor: options.actor,
				origin: options.origin,
				defaultUser: options.defaultUser,
				provider: name,
				token,
				context,
			});
		});

		context.log.info('Translated external event', {
			slugs: cards.map((translatedCard) => {
				return translatedCard.slug;
			}),
		});

		return cards;
	}

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
				provider: name,
				origin: '',
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
		session: string,
	) {
		return syncContext.getActionContext(
			provider,
			workerContext,
			context,
			session,
		);
	}
}
