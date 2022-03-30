import * as assert from '@balena/jellyfish-assert';
import type { Contract } from '@balena/jellyfish-types/build/core';
import axios from 'axios';
import Bluebird from 'bluebird';
import _ from 'lodash';
import * as errors from './errors';
import * as oauth from './oauth';
import type { SyncActionContext } from './sync-context';
import type {
	ActorInformation,
	HttpRequestOptions,
	Integration,
	IntegrationDefinition,
	PipelineOpts,
} from './types';

const httpRequest = async <T = any>(
	options: HttpRequestOptions,
	retries: number = 30,
): Promise<{ code: number; body: T }> => {
	try {
		const path =
			options.useQuerystring && options.data
				? `${options.uri}?${new URLSearchParams(options.data).toString()}`
				: options.uri;
		const url = new URL(path, options.baseUrl);

		const result = await axios({
			method: options.method,
			url: url.href,
			headers: options.headers,
			data: options.useQuerystring ? undefined : options.data,
		});

		return {
			code: result.status,
			body: result.data,
		};
	} catch (error) {
		if (axios.isAxiosError(error) && error.response) {
			// Automatically retry on server failures
			if (error.response.status >= 500) {
				assert.USER(
					null,
					retries > 0,
					errors.SyncExternalRequestError,
					`External service responded with ${error.response.status} to ${options.uri}`,
				);

				await Bluebird.delay(2000);
				return httpRequest(options, retries - 1);
			}

			// Automatically retry on rate limit or request time out
			if (error.response.status === 429 || error.response.status === 408) {
				assert.USER(
					null,
					retries > 0,
					errors.SyncRateLimit,
					`External service rate limit with ${error.response.status} to ${options.uri}`,
				);

				await Bluebird.delay(5000);
				return httpRequest(options, retries - 1);
			}

			return {
				code: error.response.status,
				body: error.response.data,
			};
		}
		throw error;
	}
};

const setProperty = (
	contract: any,
	object: any,
	path: _.Many<string | number | symbol>,
) => {
	if (_.has(object, path)) {
		_.set(contract, path, _.get(object, path) || _.get(contract, path));
	}
};

const getOrCreate = async (
	context: SyncActionContext,
	object: Partial<Contract> & { type: string },
) => {
	// TODO: Attempt to unify user contracts based on
	// their e-mails. i.e. if two user contracts have
	// the same e-mail then they are likely the
	// same user.
	const contract = await context.getElementBySlug(
		`${object.slug}@${object.version}`,
	);
	if (contract) {
		// Set union of all known e-mails
		const emailPropertyPath = ['data', 'email'];
		if (_.has(object, emailPropertyPath)) {
			const emails = _.sortBy(
				_.compact(
					_.union(
						_.castArray(_.get(contract, emailPropertyPath)),
						_.castArray(_.get(object, emailPropertyPath)),
					),
				),
			);
			_.set(
				contract,
				emailPropertyPath,
				emails.length === 1 ? _.first(emails) : emails,
			);
		}

		setProperty(contract, object, ['data', 'profile', 'company']);
		setProperty(contract, object, ['data', 'profile', 'name', 'first']);
		setProperty(contract, object, ['data', 'profile', 'name', 'last']);
		setProperty(contract, object, ['data', 'profile', 'title']);
		setProperty(contract, object, ['data', 'profile', 'country']);
		setProperty(contract, object, ['data', 'profile', 'city']);

		context.log.info('Unifying actor contracts', {
			target: contract,
			source: object,
		});

		await context.upsertElement(contract.type, _.omit(contract, ['type']), {
			timestamp: new Date(),
		});

		return contract.id;
	}

	context.log.info('Inserting non-existent actor', {
		slug: object.slug,
		data: object.data,
	});

	const result = await context.upsertElement(
		object.type,
		_.omit(object, ['type']),
		{
			timestamp: new Date(),
		},
	);

	// The result of an upsert might be null if the upsert
	// didn't change anything (a no-op update), so in that
	// case we can fetch the user contract from the database.
	if (!result) {
		const existentContract = await context.getElementBySlug(
			`${object.slug}@${object.version}`,
		);

		// If the contract can't be loaded something weird has happened
		if (!existentContract) {
			throw Error(
				`Upsert returned null, but can't retrieve contract: ${object.slug}@${object.version}`,
			);
		}

		return existentContract.id;
	}

	return result.id;
};

const getOAuthUser = async (
	context: {
		getElementById: (arg0: any) => any;
		getElementBySlug: (arg0: string, arg1?: boolean) => any;
	},
	provider: any,
	actor: any,
	options: { defaultUser: any },
) => {
	const userContract = await context.getElementById(actor);
	assert.INTERNAL(
		null,
		userContract,
		errors.SyncNoActor,
		`No such actor: ${actor}`,
	);

	const tokenPath = ['data', 'oauth', provider];
	if (_.has(userContract, tokenPath)) {
		return userContract;
	}

	assert.INTERNAL(
		null,
		options.defaultUser,
		errors.SyncOAuthNoUserError,
		`No default integrations actor to act as ${actor} for ${provider}`,
	);

	const defaultUserContract = await context.getElementBySlug(
		`user-${options.defaultUser}@latest`,
		true,
	);

	assert.INTERNAL(
		null,
		defaultUserContract,
		errors.SyncNoActor,
		`No such actor: ${options.defaultUser}`,
	);

	assert.USER(
		null,
		_.has(defaultUserContract, tokenPath),
		errors.SyncOAuthNoUserError,
		`Default actor ${options.defaultUser} does not support ${provider}`,
	);

	return defaultUserContract;
};

export const run = async (
	integration: IntegrationDefinition,
	token: any,
	fn: (integrationInstance: Integration) => any,
	options: Omit<PipelineOpts, 'token'>,
) => {
	const getUsername = options.context.getLocalUsername || _.identity;

	// eslint-disable-next-line new-cap
	const instance = await integration.initialize({
		token,
		defaultUser: options.defaultUser,
		context: {
			log: options.context.log,
			getContactByEmail: options.context.getContactByEmail,
			getRemoteUsername: options.context.getRemoteUsername,
			getLocalUsername: options.context.getLocalUsername,
			getElementBySlug: options.context.getElementBySlug,
			getElementById: options.context.getElementById,
			getElementByMirrorId: options.context.getElementByMirrorId,
			request: async (actor: string, requestOptions: HttpRequestOptions) => {
				assert.INTERNAL(
					null,
					actor,
					errors.SyncNoActor,
					'Missing request actor',
				);

				if (!integration.OAUTH_BASE_URL || !token.appId || !token.appSecret) {
					return httpRequest(requestOptions);
				}

				options.context.log.info('Sync: OAuth origin URL', {
					origin: options.origin,
				});
				assert.INTERNAL(
					null,
					!!options.origin,
					errors.SyncOAuthError,
					'Missing OAuth origin URL',
				);

				options.context.log.info('Sync: Getting OAuth user', {
					actor,
					provider: options.provider,
					defaultUser: options.defaultUser,
				});
				const userContract = await getOAuthUser(
					options.context,
					options.provider,
					actor,
					{
						defaultUser: options.defaultUser,
					},
				);
				options.context.log.info('Sync OAuth user', {
					id: userContract.id,
				});

				const tokenPath = ['data', 'oauth', options.provider];
				const tokenData = _.get(userContract, tokenPath);
				if (tokenData) {
					_.set(
						requestOptions,
						['headers', 'Authorization'],
						`Bearer ${tokenData.access_token}`,
					);
				}

				const result = await httpRequest(requestOptions);

				// Lets try refreshing the token and retry if so
				if (result.code === 401 && tokenData) {
					options.context.log.info('Refreshing OAuth token', {
						provider: options.provider,
						user: userContract.slug,
						origin: options.origin,
						appId: token.appId,
						oldToken: tokenData.access_token,
					});

					/*
					 * Keep in mind that there exists the possibility
					 * that we refresh the token on the provider's API
					 * but we fail to save the result to the user's
					 * contract, in which case the user will need to re-link
					 * his account.
					 */
					const newToken = await oauth.refreshAccessToken(
						integration.OAUTH_BASE_URL,
						tokenData,
						{
							appId: token.appId,
							appSecret: token.appSecret,
							redirectUri: options.origin,
						},
					);
					_.set(userContract, tokenPath, newToken);
					await options.context.upsertElement(
						userContract.type,
						_.omit(userContract, ['type']),
						{
							timestamp: new Date(),
						},
					);

					_.set(
						requestOptions,
						['headers', 'Authorization'],
						`Bearer ${newToken.access_token}`,
					);

					return httpRequest(requestOptions);
				}

				return result;
			},
			getActorId: async (information: ActorInformation) => {
				options.context.log.info('Creating sync actor', information);

				const username = information.handle || information.email;
				if (!username) {
					throw new Error("Can't get an actor id without a handle or email");
				}
				const translatedUsername = getUsername(username.toLowerCase());
				const slug = translatedUsername
					.toLowerCase()
					.replace(/[^a-z0-9-]/g, '-');

				// There is a known Front/Intercom issue where some messages
				// would arrive (or be duplicated) as coming from the "intercom"
				// user, without any way to get to the actual actor (from either
				// the webhooks or the API).
				// We declared this as a "can't fix", but this log line will be
				// useful to get a pulse of the problem.
				if (slug === 'intercom') {
					options.context.log.warn('Using "intercom" actor', information);
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

				return getOrCreate(options.context, {
					slug: `user-${slug}`,
					active: _.isBoolean(information.active) ? information.active : true,
					type: 'user@1.0.0',
					version: '1.0.0',
					data,
				});
			},
		},
	});

	try {
		const result = await fn(instance);
		await instance.destroy();
		return result;
	} catch (error) {
		await instance.destroy();
		throw error;
	}
};
