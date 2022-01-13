import strict from 'assert';
import * as assert from '@balena/jellyfish-assert';
import * as metrics from '@balena/jellyfish-metrics';
import type { Contract } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import * as errors from './errors';
import * as instance from './instance';
import * as oauth from './oauth';
import * as pipeline from './pipeline';
import * as syncContext from './sync-context';
import type { SyncActionContext } from './sync-context';
import type { IntegrationConstructor, WorkerContext } from './types';

export { IntegrationConstructor };

/**
 * Jellyfish sync library module.
 *
 * @module sync
 */

interface SyncOptions {
	integrations?: {
		[key: string]: IntegrationConstructor;
	};
}

export class Sync {
	integrations: {
		[key: string]: IntegrationConstructor;
	};
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
	 * @param {String} integration - integration name
	 * @param {Object} token - token details
	 * @param {String} slug - user slug
	 * @param {Object} options - options
	 * @param {String} options.origin - The callback URL
	 * @returns {String} Authorize URL
	 */
	getAssociateUrl(
		integration: string,
		token: any,
		slug: string,
		options: { origin: string },
	) {
		const Integration = this.integrations[integration];
		if (!Integration || !token || !token.appId) {
			return null;
		}

		// TS-TODO: OAUTH_BASE_URL and OAUTH_SCOPES might not exist on
		// Integration, but it's assumed that they are.
		return oauth.getAuthorizeUrl(
			Integration.OAUTH_BASE_URL!,
			Integration.OAUTH_SCOPES!,
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
	 * @param {String} integration - integration name
	 * @param {Object} token - token details
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.code - short lived OAuth code
	 * @param {String} options.origin - The callback URL
	 * @returns {Object} external provider's access token
	 */
	async authorize(
		integration: string,
		token: any,
		context: SyncActionContext,
		options: {
			code: string;
			origin: string;
		},
	) {
		const Integration = this.integrations[integration];

		assert.INTERNAL(
			context,
			!!Integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${integration}`,
		);

		assert.INTERNAL(
			context,
			token && token.appId && token.appSecret,
			errors.SyncNoIntegrationAppCredentials,
			`No application credentials found for integration: ${integration}`,
		);

		return oauth.getAccessToken(Integration.OAUTH_BASE_URL, options.code, {
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
	 * @param {String} integration - integration name
	 * @param {String} credentials - access token for external provider api
	 * @returns {Object} external user
	 */
	async whoami(
		context: SyncActionContext,
		integration: string,
		credentials: any,
	) {
		const Integration = this.integrations[integration];

		assert.INTERNAL(
			context,
			!!Integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${integration}`,
		);

		assert.INTERNAL(
			context,
			!!Integration.whoami,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${integration} does not provide a whoami() function`,
		);

		strict.ok(Integration.whoami);
		return Integration.whoami(context, credentials, {
			errors,
		});
	}

	/**
	 * @summary Gets local user matching the external user
	 * @function
	 * @public
	 *
	 * @param {Object} context - execution context
	 * @param {String} integration - integration name
	 * @param {Object} externalUser - external user
	 * @param {Object} options - options
	 * @param {String} options.slug - slug to be used as a fallback to get a user
	 * @returns {Object} external user
	 */
	async match(
		context: SyncActionContext,
		integration: string,
		externalUser: any,
		options: {
			slug: string;
		},
	) {
		const Integration = this.integrations[integration];

		assert.INTERNAL(
			context,
			!!Integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${integration}`,
		);

		assert.INTERNAL(
			context,
			!!Integration.match,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${integration} does not provide a match() function`,
		);

		strict.ok(Integration.match);
		const user = await Integration.match(context, externalUser, {
			errors,
			slug: `${options.slug}@latest`,
		});

		if (user) {
			assert.INTERNAL(
				context,
				user.slug === options.slug,
				errors.SyncNoMatchingUser,
				`Could not find matching user for provider: ${integration}, slugs do not match ${user.slug} !== ${options.slug}`,
			);
		}

		return user;
	}

	async getExternalUserSyncEventData(
		context: any,
		integration: string,
		externalUser: any,
	) {
		const Integration = this.integrations[integration];

		assert.INTERNAL(
			context,
			!!Integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration for provider: ${integration}`,
		);

		assert.INTERNAL(
			context,
			!!Integration.getExternalUserSyncEventData,
			errors.SyncNoCompatibleIntegration,
			`Integration for ${integration} does not provide a getExternalUserSyncEventData() function`,
		);

		strict.ok(Integration.getExternalUserSyncEventData);
		const event = await Integration.getExternalUserSyncEventData(
			context,
			externalUser,
			{
				errors,
			},
		);

		assert.INTERNAL(
			context,
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
	 * @param {String} integration - integration name
	 * @param {Object} userCard - user to associate external token to
	 * @param {Object} credentials - external provider's api token
	 * @param {Object} context - execution context
	 * @returns {Object} Upserted user card
	 */
	async associate(
		integration: string,
		userCard: Contract,
		credentials: any,
		context: SyncActionContext,
	) {
		const Integration = this.integrations[integration];

		assert.INTERNAL(
			context,
			!!Integration,
			errors.SyncNoCompatibleIntegration,
			`There is no compatible integration: ${integration}`,
		);

		/*
		 * Set the access token in the user card.
		 */
		_.set(userCard, ['data', 'oauth', integration], credentials);
		return context.upsertElement(userCard.type, _.omit(userCard, ['type']), {
			timestamp: new Date(),
		});
	}

	/**
	 * @summary Check if an external event request is valid
	 * @function
	 * @public
	 *
	 * @param {String} integration - integration name
	 * @param {Object} token - token details
	 * @param {Object} event - event
	 * @param {String} event.raw - raw event payload
	 * @param {Object} event.headers - request headers
	 * @param {Object} context - logger context
	 * @returns {Boolean} whether the external event should be accepted or not
	 */
	async isValidEvent(
		integration: string,
		token: any,
		event: any,
		context: any,
	) {
		const Integration = this.integrations[integration];
		if (!Integration || !token) {
			return false;
		}

		return Integration.isEventValid(token, event.raw, event.headers, context);
	}

	/**
	 * @summary Mirror back a card insert coming from Jellyfish
	 * @function
	 * @public
	 *
	 * @param {String} integration - integration name
	 * @param {Object} token - token details
	 * @param {Object} card - action target card
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @param {String} [options.origin] - OAuth origin URL
	 * @returns {Object[]} inserted cards
	 */
	async mirror(
		integration: string,
		token: any,
		card: Contract,
		context: SyncActionContext,
		options: {
			actor: string;
			origin: string;
			defaultUser: string;
		},
	) {
		if (!token) {
			context.log.warn('Ignoring mirror as there is no token', {
				integration,
			});

			return [];
		}

		const Integration = this.integrations[integration];
		if (!Integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration,
				},
			);

			return [];
		}

		return pipeline.mirrorCard(Integration, card, {
			actor: options.actor,
			origin: options.origin,
			defaultUser: options.defaultUser,
			provider: integration,
			token,
			context,
		});
	}

	/**
	 * @summary Translate an external event into Jellyfish
	 * @function
	 * @public
	 *
	 * @param {String} integration - integration name
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
		integration: string,
		token: string,
		card: Contract,
		context: SyncActionContext,
		options: {
			actor: string;
			defaultUser: string;
			origin: string;
		},
	) {
		if (!token) {
			context.log.warn('Ignoring translate as there is no token', {
				integration,
			});

			return [];
		}

		const Integration = this.integrations[integration];
		if (!Integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration,
				},
			);

			return [];
		}

		context.log.info('Translating external event', {
			id: card.id,
			slug: card.slug,
			integration,
		});

		const cards = await metrics.measureTranslate(integration, async () => {
			return pipeline.translateExternalEvent(Integration, card, {
				actor: options.actor,
				origin: options.origin,
				defaultUser: options.defaultUser,
				provider: integration,
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
	 * @param {String} integration - integration name
	 * @param {Object} token - token details
	 * @param {String} file - file id
	 * @param {Object} context - execution context
	 * @param {Object} options - options
	 * @param {String} options.actor - actor id
	 * @returns {Buffer} file
	 */
	async getFile(
		integration: string,
		token: any,
		file: string,
		context: SyncActionContext,
		options: {
			actor: string;
		},
	): Promise<Buffer | null> {
		if (!token) {
			context.log.warn('Not fetching file as there is no token', {
				integration,
			});

			return null;
		}

		const Integration = this.integrations[integration];
		if (!Integration) {
			context.log.warn(
				'Ignoring mirror as there is no compatible integration',
				{
					integration,
				},
			);

			return null;
		}

		context.log.info('Retrieving external file', {
			file,
			integration,
		});

		// TS-TODO: Its unclear if the origin and defaultUser options are required
		return instance.run(
			Integration,
			token,
			async (integrationInstance) => {
				return integrationInstance.getFile(file);
			},
			{
				actor: options.actor,
				provider: integration,
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
