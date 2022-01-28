import * as assert from '@balena/jellyfish-assert';
import { Kernel } from '@balena/jellyfish-core';
import { getLogger } from '@balena/jellyfish-logger';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import _ from 'lodash';
import jsonpatch, { Operation } from 'fast-json-patch';
import * as workerErrors from '../errors';
import type { WorkerContext } from '../types';
import {
	ActorInformation,
	IntegrationDefinition,
	IntegrationExecutionOptions,
} from './types';
import * as errors from './errors';
import * as utils from './utils';
import * as oauth from './oauth';

const logger = getLogger(__filename);

/*
 * Deal with some username differences that we can't
 * fix in any other way.
 */
interface ActorTranslatorMap {
	local: string;
	remote: string;
}

const ACTOR_TRANSLATORS: { [key: string]: ActorTranslatorMap[] } = {
	discourse: [
		{
			local: 'page-',
			remote: '_page',
		},
	],
};
export interface Logger {
	warn: (message: string, data: any) => void;
	error: (message: string, data: any) => void;
	debug: (message: string, data: any) => void;
	info: (message: string, data: any) => void;
	exception: (message: string, error: any) => void;
}
export interface SyncActionContext {
	logger: Logger;
	getLocalUsername: (username: string) => string;
	getRemoteUsername: (username: string) => string;
	upsertElement: (
		type: string,
		object:
			| Partial<Contract>
			| { id: string; type: string; patch: Operation[] },
		options: { actor?: string; timestamp?: Date; originator?: string },
	) => Promise<Contract | null>;
	getElementBySlug: (
		slug: string,
		usePrivilegedSession?: boolean,
	) => Promise<Contract | null>;
	getElementById: (id: string) => Promise<Contract | null>;
	getElementByMirrorId: (
		type: string,
		mirrorId: string,
		options: { usePattern?: boolean },
	) => Promise<Contract | null>;
}

export interface IntegrationExecutionContext {
	logger: Logger;
	getLocalUsername: (username: string) => string;
	getRemoteUsername: (username: string) => string;
	getElementBySlug: (
		slug: string,
		usePrivilegedSession?: boolean,
	) => Promise<Contract | null>;
	getElementById: (id: string) => Promise<Contract | null>;
	getElementByMirrorId: (
		type: string,
		mirrorId: string,
		options: { usePattern?: boolean },
	) => Promise<Contract | null>;
	request: <T>(
		actor: boolean,
		requestOptions: any,
	) => Promise<{ code: number; body: T }>;
	getActorId: (information: ActorInformation) => Promise<string>;
}

/**
 * @name getActionContext
 * @description This function generates a "context" object that provides a common interface for use by sync integrations.
 *
 * @param {String} provider - The name of the integration e.g. 'github', 'discourse'
 * @param {Object} workerContext - Context object provided to action functions by
 * the jellyfish worker
 * @param {Object} context - Logging context object
 * @param {String} session - session token used to interact with Jellyfish
 *
 * @returns {Object}
 *
 * @example
 *
 * const handler = async (session, context, card, request) => {
 * 	const syncContext = context.sync.getActionContext(request.arguments.provider,
 * 			context, request.context, context.privilegedSession)
 * 	)
 * 	.....
 * }
 */
export const getSyncActionContext = (
	provider: string,
	workerContext: WorkerContext,
	context: any,
	session: string,
): SyncActionContext => {
	const getDefaultActor = async (): Promise<null | string> => {
		const sessionCard = await workerContext.getCardById(session, session);

		if (!sessionCard) {
			return null;
		}

		// TODO: Replace this return type with the session contract interface
		return sessionCard.data.actor as string;
	};

	const contextObject: SyncActionContext = {
		logger: {
			warn: (message: string, data: any) => {
				logger.warn(context, message, data);
			},
			error: (message: string, data: any) => {
				logger.error(context, message, data);
			},
			debug: (message: string, data: any) => {
				logger.debug(context, message, data);
			},
			info: (message: string, data: any) => {
				logger.info(context, message, data);
			},

			// "exception" will log to sentry if it's enabled
			exception: (message: string, error: any) => {
				logger.exception(context, message, error);
			},
		},
		getLocalUsername: (username: string): string => {
			const map = _.find(ACTOR_TRANSLATORS[provider] || [], {
				remote: username,
			});

			return map ? map.local : username;
		},
		getRemoteUsername: (username: string): string => {
			const map = _.find(ACTOR_TRANSLATORS[provider] || [], {
				local: username,
			});

			return map ? map.remote : username;
		},

		// The upsertElement function has the property of being eventually
		// consistent, sanely handling two seperate sync events on a new
		// object with the same slug. If an ID is provided we don't need to do any
		// checking though, as the object already exists and it can be patched
		// immediately.
		// Object can either be a partial contract object or an object with keys
		// "id" and "patch", where id is the id of the target contract and patch is
		// a jsonpatch
		upsertElement: async (
			type: string,
			object:
				| Partial<Contract>
				| { id: string; type: string; patch: Operation[] },
			options: { actor?: string; timestamp?: Date; originator?: string },
		): Promise<Contract | null> => {
			const typeCard = await workerContext.getCardBySlug(session, type);

			assert.INTERNAL(
				context,
				typeCard !== null,
				workerErrors.WorkerNoElement,
				`No such type: ${type}`,
			);

			const actor = options.actor || (await getDefaultActor());
			strict(actor);

			// If an ID was passed in, use that ID to load the current card, this
			// prevents the situation where an integration may unintentionally
			// generate a new slug for an existing card.

			// TS-TODO: tidy up this casting as its not quite correct.
			// The main issue here is that "object" is union type and could be a partial contract, or a patch wrapper with a contract ID
			const targetContract = object as Contract;

			const current: Contract | null = targetContract.id
				? await workerContext.getCardById(session, targetContract.id)
				: await workerContext.getCardBySlug(
						session,
						`${targetContract.slug}@${targetContract.version}`,
				  );

			let patch: Operation[] = [];

			if (object.hasOwnProperty('patch')) {
				patch = (object as any).patch;
				if (!current) {
					throw new Error(
						`Can\'t patch a contract that doesn\'t exist: ${object.id}`,
					);
				}
			} else {
				if (current) {
					// TODO: Migrate all integrations to use the JSON patch interface on this function
					// so we don't have to do this diff comparison thing.
					patch = jsonpatch.compare(
						Kernel.defaults(current),
						Kernel.defaults(
							Object.assign({}, object, {
								id: current.id,
								slug: current.slug,
								name:
									typeof (object as any).name === 'string'
										? (object as any).name
										: current.name || null,
								created_at: current.created_at,
								updated_at: current.updated_at,
								linked_at: current.linked_at,
								type: current.type,
							}),
						),
					);
				} else {
					logger.info(context, 'Inserting card from sync context', object);
					return workerContext
						.insertCard(
							session,
							typeCard! as TypeContract,
							{
								attachEvents: true,
								timestamp: options.timestamp,
								actor,
								originator: options.originator,
							},
							targetContract,
						)
						.catch((error: { name: string }) => {
							// Retry, and next time we will automatically go
							// to through patch approach
							if (error.name === 'JellyfishElementAlreadyExists') {
								return contextObject.upsertElement(type, object, options);
							}
							throw error;
						});
				}
			}
			logger.info(context, 'Patching card from sync context', {
				patch,
			});
			// If the only thing being updated is the origin, skip the update as
			// it is a meaningless change.
			// TODO: refactor the "origin" to be a link to the origin instead of hard coded value
			if (
				patch.length === 1 &&
				patch[0].op === 'replace' &&
				patch[0].path === '/data/origin'
			) {
				return current;
			}

			return workerContext.patchCard(
				session,
				typeCard! as TypeContract,
				{
					attachEvents: true,
					timestamp: options.timestamp,
					actor,
					originator: options.originator,
				},
				current,
				patch,
			);
		},
		getElementBySlug: async (
			slug: string,
			usePrivilegedSession?,
		): Promise<Contract | null> => {
			return workerContext.getCardBySlug(
				usePrivilegedSession ? workerContext.privilegedSession : session,
				slug,
			);
		},
		getElementById: async (id: string): Promise<Contract | null> => {
			return workerContext.getCardById(session, id);
		},
		getElementByMirrorId: async (
			type: string,
			mirrorId: string,
			options: { usePattern?: boolean } = {},
		): Promise<Contract | null> => {
			assert.INTERNAL(
				context,
				!!mirrorId,
				Error,
				'You must supply a mirrorId as key',
			);

			const elements = await workerContext.query(
				session,
				{
					type: 'object',
					required: ['type', 'data'],
					additionalProperties: true,
					properties: {
						type: {
							type: 'string',
							const: type,
						},
						data: {
							type: 'object',
							required: ['mirrors'],
							additionalProperties: true,
							properties: {
								mirrors: {
									type: 'array',
									contains: options.usePattern
										? {
												type: 'string',
												pattern: mirrorId,
										  }
										: {
												type: 'string',
												const: mirrorId,
										  },
								},
							},
						},
					},
				},
				{
					limit: 1,
				},
			);

			return elements[0];
		},
	};
	return contextObject;
};

export const getIntegrationExecutionContext = (
	integrationDefinition: IntegrationDefinition,
	options: IntegrationExecutionOptions,
): IntegrationExecutionContext => ({
	logger: options.syncActionContext.logger,
	getRemoteUsername: options.syncActionContext.getRemoteUsername,
	getLocalUsername: options.syncActionContext.getLocalUsername,
	getElementBySlug: options.syncActionContext.getElementBySlug,
	getElementById: options.syncActionContext.getElementById,
	getElementByMirrorId: options.syncActionContext.getElementByMirrorId,
	request: async (
		actor: boolean,
		requestOptions: any,
	): Promise<{ code: number; body: any }> => {
		assert.INTERNAL(null, actor, errors.SyncNoActor, 'Missing request actor');

		// If the integration definition does not contain all required
		// OAuth information, simply make the http request as usual.
		if (
			!integrationDefinition.OAUTH_BASE_URL ||
			!options.token.appId ||
			!options.token.appSecret
		) {
			console.info('====> making standard http request');
			return utils.httpRequest(requestOptions);
		}

		options.syncActionContext.logger.info('Sync: OAuth origin URL', {
			origin: options.origin,
		});
		assert.INTERNAL(
			null,
			!!options.origin,
			errors.SyncOAuthError,
			'Missing OAuth origin URL',
		);

		options.syncActionContext.logger.info('Sync: Getting OAuth user', {
			actor,
			provider: options.provider,
			defaultUser: options.defaultUser,
		});
		const userCard = await utils.getOAuthUser(
			options.syncActionContext,
			options.provider,
			actor,
			{
				defaultUser: options.defaultUser,
			},
		);
		options.syncActionContext.logger.info('Sync OAuth user', {
			id: userCard.id,
		});

		const tokenPath = ['data', 'oauth', options.provider];
		const tokenData = _.get(userCard, tokenPath);
		if (tokenData) {
			_.set(
				requestOptions,
				['headers', 'Authorization'],
				`Bearer ${tokenData.access_token}`,
			);
		}

		const result = await utils.httpRequest(requestOptions);

		// Lets try refreshing the token and retry if so
		if (result.code === 401 && tokenData) {
			options.syncActionContext.logger.info('Refreshing OAuth token', {
				provider: options.provider,
				user: userCard.slug,
				origin: options.origin,
				appId: options.token.appId,
				oldToken: tokenData.access_token,
			});

			/*
			 * Keep in mind that there exists the possibility
			 * that we refresh the token on the provider's API
			 * but we fail to save the result to the user's
			 * card, in which case the user will need to re-link
			 * his account.
			 */
			const newToken = await oauth.refreshAccessToken(
				integrationDefinition.OAUTH_BASE_URL,
				tokenData,
				{
					appId: options.token.appId,
					appSecret: options.token.appSecret,
					redirectUri: options.origin,
				},
			);
			_.set(userCard, tokenPath, newToken);
			await options.syncActionContext.upsertElement(
				userCard.type,
				_.omit(userCard, ['type']),
				{
					timestamp: new Date(),
				},
			);

			_.set(
				requestOptions,
				['headers', 'Authorization'],
				`Bearer ${newToken.access_token}`,
			);

			return utils.httpRequest(requestOptions);
		}

		return result;
	},
	getActorId: async (information: ActorInformation): Promise<string> => {
		options.syncActionContext.logger.info('Creating sync actor', information);
		const username = information.handle || information.email;
		const translatedUsername = (
			options.syncActionContext.getLocalUsername || _.identity
		)(username.toLowerCase());
		const slug = translatedUsername.toLowerCase().replace(/[^a-z0-9-]/g, '-');

		// There is a known Front/Intercom issue where some messages
		// would arrive (or be duplicated) as coming from the "intercom"
		// user, without any way to get to the actual actor (from either
		// the webhooks or the API).
		// We declared this as a "can't fix", but this log line will be
		// useful to get a pulse of the problem.
		if (slug === 'intercom') {
			options.syncActionContext.logger.warn(
				'Using "intercom" actor',
				information,
			);
		}

		const profile: {
			title?: string;
			company?: string;
			country?: string;
			city?: string;
		} = {};

		if (information.title) {
			profile.title = information.title;
		}

		if (information.company) {
			profile.company = information.company;
		}

		if (information.country) {
			profile.country = information.country;
		}

		if (information.city) {
			profile.city = information.city;
		}

		const firstName = _.get(information, ['name', 'first']);
		const lastName = _.get(information, ['name', 'last']);
		if (firstName) {
			_.set(profile, ['name', 'first'], firstName);
		}
		if (lastName) {
			_.set(profile, ['name', 'lastName'], lastName);
		}

		const data = {
			// A hash that can never occur in the real-world
			// See https://github.com/product-os/jellyfish/issues/2011
			hash: 'PASSWORDLESS',

			roles: [],
			profile,
		};

		if (information.email) {
			// TS-TODO: Allow optional email
			(data as any).email = information.email;
		}

		return utils.getOrCreateActorContractFromFragment(
			options.syncActionContext,
			{
				slug: `user-${slug}`,
				active: _.isBoolean(information.active) ? information.active : true,
				type: 'user@1.0.0',
				version: '1.0.0',
				data,
			},
		);
	},
});
