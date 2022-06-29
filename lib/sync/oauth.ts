import * as assert from '@balena/jellyfish-assert';
import axios from 'axios';
import _ from 'lodash';
import qs from 'qs';
import { setTimeout as delay } from 'timers/promises';
import { TypedError } from 'typed-error';
import { OauthProviderContract } from '../contracts/oauth-provider';

export class OAuthInvalidOption extends TypedError {}
export class OAuthRequestError extends TypedError {}
export class OAuthUnsuccessfulResponse extends TypedError {}

/**
 * @summary Send an HTTP request
 * @function
 * @public
 *
 * @description
 * If the access token is passed, then we set the
 * "Authorization" header out of the box, and then
 * delegate to the `request` module.
 *
 * @param {(Object|Undefined)} accessToken - Access token
 * @param {Object} options - Request options
 * @param {Number} [retries] - Number of retries
 * @returns {Object} HTTP response (code, body)
 */
export const request = async (
	accessToken: { access_token: any } | null,
	options: {
		url;
		form: string;
		headers?: {
			[key: string]: string;
		};
	},
	retries = 10,
): Promise<{ code: number; body: any }> => {
	// Use access token if available
	const headers = options.headers || {};
	if (accessToken) {
		headers['Authorization'] = `Bearer ${accessToken.access_token}`;
	}

	try {
		const result = await axios.post(options.url, options.form, {
			headers,
		});
		return {
			code: result.status,
			body: result.data,
		};
	} catch (error) {
		if (axios.isAxiosError(error) && error.response) {
			// Automatically retry on server failures
			if (error.response.status >= 500 && retries > 0) {
				await delay(2000);
				return request(accessToken, options, retries - 1);
			}

			// Return the status code and result body for the calling function to handle
			return {
				code: error.response.status,
				body: error.response.data,
			};
		}
		throw error;
	}
};

const oauthPost = async (
	url: string,
	data: {
		grant_type: string;
		client_id: any;
		client_secret: any;
		code?: any;
		refresh_token?: any;
	},
) => {
	const { code, body } = await request(null, {
		url,
		form: qs.stringify(data),
	});

	assert.INTERNAL(null, code < 500, OAuthRequestError, () => {
		return `POST ${url} responded with ${code}: ${JSON.stringify(
			body,
			null,
			2,
		)}`;
	});

	assert.INTERNAL(null, code < 400, OAuthUnsuccessfulResponse, () => {
		return [
			`POST ${url} responded with ${code}:`,
			JSON.stringify(body, null, 2),
			`to payload: ${JSON.stringify(data, null, 2)}`,
		].join(' ');
	});

	assert.INTERNAL(null, code === 200, OAuthRequestError, () => {
		return `POST ${url} responded with ${code}: ${JSON.stringify(
			body,
			null,
			2,
		)}`;
	});

	return body;
};

/**
 * @summary Swap a short lived token for an access token
 * @function
 * @public
 *
 * @description
 * This function takes a short lived token an exchanges it
 * for a proper access token that looks like this:
 *
 * {
 *   "access_token": "MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3",
 *   "token_type": "bearer",
 *   "expires_in": 3600,
 *   "refresh_token": "IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk",
 *   "scope": "create"
 * }
 *
 * @param {OauthProviderContract} provider - Oauth provider contract to get info from
 * @param {String} code - Short-lived token
 * @returns {Object} New access token
 * @returns {Object} Access token
 */
export const getAccessToken = async (
	provider: OauthProviderContract,
	code: string,
) => {
	assert.INTERNAL(null, Boolean(code), OAuthInvalidOption, 'Missing code');

	return oauthPost(provider.data.tokenUrl, {
		grant_type: 'authorization_code',
		client_id: provider.data.clientId,
		client_secret: provider.data.clientSecret,
		code,
	});
};

/**
 * @summary Refresh an expired access token
 * @public
 * @function
 *
 * @description The `accessToken` argument should be previously
 * adquired through `.getAccessToken()`. The result of this
 * function is the same as `.getAccessToken()`.
 *
 * @param {OauthProviderContract} provider - Oauth provider contract to get info from
 * @param {String} refreshToken - The refresh token
 * @returns {Object} New access token
 */
export const refreshAccessToken = async (
	provider: OauthProviderContract,
	refreshToken: string,
) => {
	return oauthPost(provider.data.tokenUrl, {
		grant_type: 'refresh_token',
		client_id: provider.data.clientId,
		client_secret: provider.data.clientSecret,
		refresh_token: refreshToken,
	});
};
