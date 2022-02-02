import axios, { AxiosError, Method } from 'axios';
import jsone from 'json-e';
import * as assert from '@balena/jellyfish-assert';
import * as errors from './errors';
import _ from 'lodash';
import { SyncActionContext } from './context';
import { Contract } from '@balena/jellyfish-types/build/core';
import axiosRetry from 'axios-retry';

export interface HttpRequestOptions {
	method: Method;
	baseUrl: string;
	url: string;
	headers?: {
		[key: string]: string;
	};
	data?:
		| string
		| {
				[key: string]: any;
		  };
}

export interface HttpResponse<T> {
	code: number;
	body: T;
}

/**
 * @summary Evaluate $eval attributes in an object based on the provided context.
 * @function
 * @private
 *
 * @param {Object} object - object
 * @param {Object} context - context
 * @returns {(Object|null)} evaluated object
 *
 * @example
 * const result = evaluateObjectWithContext({
 *   foo: {
 *     $eval: 'hello'
 *   }
 * }, {
 *   hello: 1
 * })
 *
 * console.log(result)
 * > {
 * >   foo: 1
 * > }
 */
export const evaluateObjectWithContext = (object: any, context: any) => {
	if (!object) {
		return object;
	}

	if (object.$eval) {
		try {
			return jsone(object, context);
		} catch (error: any) {
			if (error.name === 'InterpreterError') {
				return null;
			}

			throw error;
		}
	}

	for (const key of Object.keys(object)) {
		// For performance reasons
		// eslint-disable-next-line lodash/prefer-lodash-typecheck
		if (typeof object[key] !== 'object' || object[key] === null) {
			continue;
		}

		const result = evaluateObjectWithContext(object[key], context);
		if (!result) {
			return null;
		}

		object[key] = result;
	}

	return object;
};
/**
 * @summary Make an HTTP request, retyring on error up to `retries`.
 * @function
 * @param options
 * @param retries
 * @returns
 */
export const httpRequest = async <T = any>(
	options: HttpRequestOptions,
	retries = 30,
): Promise<HttpResponse<T>> => {
	const client = axios.create({
		baseURL: options.baseUrl,
	});

	axiosRetry(client, {
		retries,
		retryCondition: (error: AxiosError) => {
			if (axios.isAxiosError(error) && error.response) {
				if (error.response.status >= 500) {
					return true;
				}
			} else if (
				error.response!.status === 429 ||
				error.response!.status === 408
			) {
				return true;
			}
			return false;
		},
		retryDelay: (_count: number, error: AxiosError) => {
			if (axios.isAxiosError(error) && error.response) {
				if (error.response.status >= 500) {
					return 2000;
				}
			} else if (
				error.response!.status === 429 ||
				error.response!.status === 408
			) {
				return 5000;
			}
			return 1000;
		},
	});

	try {
		const result = await client.request({
			method: options.method || 'GET',
			url: options.url,
			data: options.data || {},
			headers: options.headers || {},
		});
		return {
			code: result.status,
			body: result.data,
		};
	} catch (error: any) {
		if (axios.isAxiosError(error) && error.response) {
			return {
				code: error.response.status,
				body: error.response.data,
			};
		}
		throw error;
	}
};

/**
 * @summary Retrieve the contract with ID equal to the `actorId` parameter.
 * If this contract does not contain an entry for the specified provider
 * within the `data.oath` object, try to return a default user contract instead.
 * If the argument `defaultUser` is missing, or in case the default user contract
 * does not contain an entry for the specificed oauth provider within the `data.oauth`
 * object, throw an error.
 * @function
 * @private
 *
 * @param {Object} context - object
 * @param {string} provider - name of the required oauth provider
 * @param {string} actorId - ID of the requested actor contract
 * @param {string} defaultUser - name (?) of the default user to return in case the requested
 * actor is not associated with the required oauth provider. This will be used to perform a
 * search by contract slug, so in case `defaultActor` is 'foo', the contract with slug 'user-foo@latest'
 * will be returned.
 */
export const getOAuthUserContract = async (
	context: {
		getElementById: (id: any) => Promise<Contract | null>;
		getElementBySlug: (
			slug: string,
			usePrivilegedSession?: boolean,
		) => Promise<Contract | null>;
	},
	provider: string,
	actorId: string,
	defaultUser?: string,
): Promise<Contract | null> => {
	const userContract = await context.getElementById(actorId);

	assert.INTERNAL(
		null,
		userContract,
		errors.SyncNoActor,
		`No such actor: ${actorId}`,
	);

	// If the card already has a token for the requested provider, return it.
	const tokenPath = ['data', 'oauth', provider];
	if (_.has(userContract, tokenPath)) {
		return userContract;
	}

	assert.INTERNAL(
		null,
		defaultUser,
		errors.SyncOAuthNoUserError,
		`No default integrations actor to act as ${actorId} for ${provider}`,
	);

	// If the user corresponding to the provided actor ID does not have an
	// OAuth token for the requested provider, return a default user.
	const defaultUserContract = await context.getElementBySlug(
		`user-${defaultUser}@latest`,
		true,
	);

	assert.INTERNAL(
		null,
		defaultUserContract,
		errors.SyncNoActor,
		`Contract not found for the default user: ${defaultUser}`,
	);

	assert.USER(
		null,
		_.has(defaultUserContract, tokenPath),
		errors.SyncOAuthNoUserError,
		`Default actor ${defaultUser} does not support ${provider}`,
	);

	return defaultUserContract;
};

export const getOrCreateActorContractFromFragment = async (
	context: SyncActionContext,
	fragment: Partial<Contract> & { type: string },
): Promise<string> => {
	// TODO: Attempt to unify user cards based on
	// their e-mails. i.e. if two user cards have
	// the same e-mail then they are likely the
	// same user.
	const contract = await context.getElementBySlug(
		`${fragment.slug}@${fragment.version}`,
	);
	if (contract) {
		// Set union of all known e-mails
		const emailPropertyPath = ['data', 'email'];
		if (_.has(fragment, emailPropertyPath)) {
			const emails = _.sortBy(
				_.compact(
					_.union(
						_.castArray(_.get(contract, emailPropertyPath)),
						_.castArray(_.get(fragment, emailPropertyPath)),
					),
				),
			);
			_.set(
				contract,
				emailPropertyPath,
				emails.length === 1 ? _.first(emails) : emails,
			);
		}

		setContractProperty(contract, fragment, ['data', 'profile', 'company']);
		setContractProperty(contract, fragment, [
			'data',
			'profile',
			'name',
			'first',
		]);
		setContractProperty(contract, fragment, [
			'data',
			'profile',
			'name',
			'last',
		]);
		setContractProperty(contract, fragment, ['data', 'profile', 'title']);
		setContractProperty(contract, fragment, ['data', 'profile', 'country']);
		setContractProperty(contract, fragment, ['data', 'profile', 'city']);

		context.logger.info('Unifying actor contracts', {
			target: contract,
			source: fragment,
		});

		await context.upsertElement(contract.type, _.omit(contract, ['type']), {
			timestamp: new Date(),
		});

		return contract.id;
	}

	context.logger.info('Creating new actor', {
		slug: fragment.slug,
		data: fragment.data,
	});

	const result = await context.upsertElement(
		fragment.type,
		_.omit(fragment, ['type']),
		{
			timestamp: new Date(),
		},
	);

	// The result of an upsert might be null if the upsert
	// didn't change anything (a no-op update), so in that
	// case we can fetch the user contract from the database.
	if (!result) {
		const existentCard = await context.getElementBySlug(
			`${fragment.slug}@${fragment.version}`,
		);

		// If the contract can't be loaded something weird has happened
		if (!existentCard) {
			throw Error(
				`Upsert returned null, but can't retrieve contract: ${fragment.slug}@${fragment.version}`,
			);
		}

		return existentCard.id;
	}

	return result.id;
};

export const setContractProperty = (
	contract: any,
	object: any,
	path: _.Many<string | number | symbol>,
) => {
	if (_.has(object, path)) {
		_.set(contract, path, _.get(object, path) || _.get(contract, path));
	}
};
