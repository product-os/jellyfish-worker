import _ from 'lodash';
import nock from 'nock';
import querystring from 'querystring';
import { OauthProviderContract } from '../contracts/oauth-provider';
import * as oauth from './oauth';

const authorizationNock = () => {
	nock('https://api.balena-cloud.com')
		.post('/oauth/token')
		.reply((_uri, request, callback) => {
			const body = querystring.decode(request as string);

			if (
				_.isEqual(body, {
					grant_type: 'authorization_code',
					client_id: 'xxxxxxxxxxxx',
					client_secret: 'yyyyyyyy',
					code: '123456',
				})
			) {
				return callback(null, [
					200,
					{
						access_token: 'MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3',
						token_type: 'bearer',
						expires_in: 3600,
						refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
						scope: 'create',
					},
				]);
			}

			return callback(null, [
				400,
				{
					error: 'invalid_request',
					error_description: 'Something went wrong',
				},
			]);
		});
};

const refreshNock = () => {
	nock('https://api.balena-cloud.com')
		.post('/oauth/token')
		.reply((_uri, request, callback) => {
			const body = querystring.decode(request as string);

			if (
				_.isEqual(body, {
					grant_type: 'refresh_token',
					client_id: 'xxxxxxxxxxxx',
					client_secret: 'yyyyyyyy',
					refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
				})
			) {
				return callback(null, [
					200,
					{
						access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
						token_type: 'bearer',
						expires_in: 3600,
						refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
						scope: 'create',
					},
				]);
			}

			return callback(null, [
				400,
				{
					error: 'invalid_request',
					error_description: 'Something went wrong',
				},
			]);
		});
};

beforeEach(() => {
	nock.cleanAll();
	nock.disableNetConnect();
});

afterAll(() => {
	nock.cleanAll();
});

const provider: OauthProviderContract = {
	id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e93',
	slug: 'oauth-provider-balena-cloud',
	type: 'oauth-provider@1.0.0',
	version: '1.0.0',
	tags: [],
	markers: [],
	active: true,
	created_at: Date.now().toString(),
	requires: [],
	capabilities: [],
	data: {
		authorizeUrl: 'https://api.balena-cloud.com/auth',
		tokenUrl: 'https://api.balena-cloud.com/oauth/token',
		clientId: 'xxxxxxxxxxxx',
		clientSecret: 'yyyyyyyy',
		integration: 'balena-cloud',
	},
};

describe('oauth', () => {
	describe('.getAccessToken()', () => {
		test('should return the access token if successful', async () => {
			authorizationNock();

			const result = await oauth.getAccessToken(provider, '123456');

			expect(result).toEqual({
				access_token: 'MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3',
				token_type: 'bearer',
				expires_in: 3600,
				refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
				scope: 'create',
			});
		});

		test('should throw given the wrong code', async () => {
			authorizationNock();

			await expect(
				oauth.getAccessToken(provider, 'oooooo'),
			).rejects.toThrowError();
		});
	});

	describe('.refreshAccessToken()', () => {
		test('should return the new access token if successful', async () => {
			refreshNock();

			const result = await oauth.refreshAccessToken(
				provider,
				'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
			);

			expect(result).toEqual({
				access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
				token_type: 'bearer',
				expires_in: 3600,
				refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
				scope: 'create',
			});
		});

		test('should fail if the access token is invalid', async () => {
			authorizationNock();

			await expect(
				oauth.refreshAccessToken(provider, '0000000000000000000'),
			).rejects.toThrowError();
		});
	});

	describe('.request()', () => {
		it('should not throw when given a stauts code > 300', async () => {
			const code = 401;
			const body = 'Unauthorized';
			nock('http://www.example.com').post('/resource').reply(code, body);

			const result = await oauth.request(null, {
				url: 'http://www.example.com/resource',
				form: 'foobar',
			});

			expect(result.code).toEqual(code);
		});
	});
});
