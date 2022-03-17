import * as assert from '@balena/jellyfish-assert';
import axios from 'axios';
import Bluebird from 'bluebird';
import _ from 'lodash';
import qs from 'qs';
import { TypedError } from 'typed-error';
import url from 'url';

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
		baseUrl: string;
		uri: string;
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
		const result = await axios.post(
			`${options.baseUrl}${options.uri}`,
			options.form,
			{
				headers,
			},
		);
		return {
			code: result.status,
			body: result.data,
		};
	} catch (error) {
		if (axios.isAxiosError(error) && error.response) {
			// Automatically retry on server failures
			if (error.response.status >= 500 && retries > 0) {
				await Bluebird.delay(2000);
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

/**
 * @summary Get external authorize URL
 * @function
 * @public
 *
 * @description
 * This is the external OAuth URL that we must redirect
 * people to in order to confirm the authorization. When
 * that happens, the external service will direct the user
 * back to us along with a short lived code that we can
 * exchange for a proper access token.
 *
 * @param {String} baseUrl - OAuth service base URL
 * @param {String[]} scopes - List of desired scopes
 * @param {Any} state - Optional metadata to return after the redirect
 * @param {Object} options - options
 * @param {String} options.appId - The client id
 * @param {String} options.redirectUri - The redirect URL
 * @returns {String} Authorize URL
 */
export const getAuthorizeUrl = (
	baseUrl: string,
	scopes: any[] = [],
	state: any,
	options: { appId: string; redirectUri: string },
) => {
	assert.INTERNAL(
		null,
		Boolean(options.appId),
		OAuthInvalidOption,
		'Missing appId',
	);
	assert.INTERNAL(
		null,
		Boolean(options.redirectUri),
		OAuthInvalidOption,
		'Missing redirectUri',
	);

	const authorizeUrl = new url.URL('/oauth/authorize', baseUrl);
	authorizeUrl.searchParams.append('response_type', 'code');
	authorizeUrl.searchParams.append('client_id', options.appId);
	authorizeUrl.searchParams.append('redirect_uri', options.redirectUri);
	authorizeUrl.searchParams.append('scope', scopes.join(' '));

	if (state) {
		const str = _.isString(state) ? state : JSON.stringify(state);
		authorizeUrl.searchParams.append('state', str);
	}

	return authorizeUrl.href;
};

const oauthPost = async (
	baseUrl: any,
	path: string,
	data: {
		grant_type: string;
		client_id: any;
		client_secret: any;
		redirect_uri: any;
		code?: any;
		refresh_token?: any;
	},
) => {
	const { code, body } = await request(null, {
		baseUrl,
		uri: path,
		form: qs.stringify(data),
	});

	assert.INTERNAL(null, code < 500, OAuthRequestError, () => {
		return `POST ${baseUrl}${path} responded with ${code}: ${JSON.stringify(
			body,
			null,
			2,
		)}`;
	});

	assert.INTERNAL(null, code < 400, OAuthUnsuccessfulResponse, () => {
		return [
			`POST ${baseUrl}${path} responded with ${code}:`,
			JSON.stringify(body, null, 2),
			`to payload: ${JSON.stringify(data, null, 2)}`,
		].join(' ');
	});

	assert.INTERNAL(null, code === 200, OAuthRequestError, () => {
		return `POST ${baseUrl}${path} responded with ${code}: ${JSON.stringify(
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
 * @param {String} baseUrl - OAuth service base URL
 * @param {String} code - Short-lived token
 * @param {Object} options - options
 * @param {String} options.appId - The client id
 * @param {String} options.appSecret - The client secret
 * @param {String} options.redirectUri - The redirect URL
 * @returns {Object} Access token
 */
export const getAccessToken = async (
	baseUrl: any,
	code: any,
	options: { appId: any; appSecret: any; redirectUri: any },
) => {
	assert.INTERNAL(
		null,
		Boolean(options.appId),
		OAuthInvalidOption,
		'Missing appId',
	);
	assert.INTERNAL(
		null,
		Boolean(options.appSecret),
		OAuthInvalidOption,
		'Missing appSecret',
	);
	assert.INTERNAL(
		null,
		Boolean(options.redirectUri),
		OAuthInvalidOption,
		'Missing redirectUri',
	);
	assert.INTERNAL(null, Boolean(code), OAuthInvalidOption, 'Missing code');

	return oauthPost(baseUrl, '/oauth2/token', {
		grant_type: 'authorization_code',
		client_id: options.appId,
		client_secret: options.appSecret,
		redirect_uri: options.redirectUri,
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
 * @param {String} baseUrl - OAuth service base URL
 * @param {Object} accessToken - Access token
 * @param {Object} options - options
 * @param {String} options.appId - The client id
 * @param {String} options.appSecret - The client secret
 * @param {String} options.redirectUri - The redirect URL
 * @returns {Object} New access token
 */
export const refreshAccessToken = async (
	baseUrl: string,
	accessToken: {
		refresh_token: any;
	},
	options: {
		appId: any;
		appSecret: any;
		redirectUri: any;
	},
) => {
	assert.INTERNAL(
		null,
		Boolean(options.appId),
		OAuthInvalidOption,
		'Missing appId',
	);
	assert.INTERNAL(
		null,
		Boolean(options.appSecret),
		OAuthInvalidOption,
		'Missing appSecret',
	);
	assert.INTERNAL(
		null,
		Boolean(options.redirectUri),
		OAuthInvalidOption,
		'Missing redirectUri',
	);
	assert.INTERNAL(
		null,
		accessToken && accessToken.refresh_token,
		OAuthInvalidOption,
		'Missing refresh token',
	);

	return oauthPost(baseUrl, '/oauth/token', {
		grant_type: 'refresh_token',
		client_id: options.appId,
		client_secret: options.appSecret,
		redirect_uri: options.redirectUri,
		refresh_token: accessToken.refresh_token,
	});
};
