import { Contract } from '@balena/jellyfish-types/build/core';
import Bluebird from 'bluebird';
import _, { constant } from 'lodash';
import nock from 'nock';
import querystring from 'querystring';
import sinon from 'sinon';
import { Sync } from '.';
import { SyncActionContext } from './context';
import * as errors from './errors';
import type {
	Integration,
	IntegrationDefinition,
	IntegrationExecutionResult,
	IntegrationInitializationOptions,
} from './types';

const sync = new Sync({
	integrationsDefinitions: {},
});

describe('sync.importContracts()', () => {
	test('should work with contract partials', async () => {
		const upsertElementSpy = sinon.spy(
			constant({
				foo: 'bar',
			}),
		);

		const mockResults: IntegrationExecutionResult[] = [
			{
				time: new Date(),
				actor: '46a045b8-95f6-42b5-bf7f-aa0a1365b9ee',
				contract: {
					type: 'card',
					slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
				},
			},
		];

		const context = {
			upsertElement: upsertElementSpy,
		} as any as SyncActionContext;

		const contracts = await sync.importIntegrationExecutionResultsAsContracts(
			context,
			mockResults,
			{},
		);

		expect(contracts.length).toBe(1);
		expect(upsertElementSpy.calledOnce).toBe(true);
		expect((upsertElementSpy.args as any)[0][0]).toBe('card');
		expect((upsertElementSpy.args as any)[0][1]).toEqual({
			active: true,
			version: '1.0.0',
			tags: [],
			markers: [],
			links: {},
			requires: [],
			capabilities: [],
			data: {},
			type: 'card',
			slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
		});
	});

	test('should work with JSONpatch', async () => {
		const upsertElementSpy = sinon.spy(
			constant({
				foo: 'bar',
			}),
		);

		const mockResults: IntegrationExecutionResult[] = [
			{
				time: new Date(),
				actor: '46a045b8-95f6-42b5-bf7f-aa0a1365b9ee',
				contract: {
					id: '78a1dfd7-21ea-405a-b269-de0b0e587975',
					type: 'card',
					slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
					patch: [
						{
							op: 'replace',
							path: '/name',
							value: 'foobar',
						},
					],
				},
			},
		];

		const context = {
			upsertElement: upsertElementSpy,
		} as any as SyncActionContext;

		const contracts = await sync.importIntegrationExecutionResultsAsContracts(
			context,
			mockResults,
			{},
		);

		expect(contracts.length).toBe(1);
		expect(upsertElementSpy.calledOnce).toBe(true);
		expect((upsertElementSpy.args as any)[0][0]).toBe('card');
		expect((upsertElementSpy.args as any)[0][1]).toEqual({
			id: '78a1dfd7-21ea-405a-b269-de0b0e587975',
			slug: 'card-78a1dfd7-21ea-405a-b269-de0b0e587975',
			type: 'card',
			patch: [
				{
					op: 'replace',
					path: '/name',
					value: 'foobar',
				},
			],
		});
	});
});

describe('.isValidEvent()', () => {
	test('should return false for an unknown integration', async () => {
		const result = await sync.isValidEvent(
			{ id: 'test' },
			'invalid',
			{
				headers: {},
				raw: '....',
			},
			{},
		);
		expect(result).toBe(false);
	});
});

describe('.getAssociateUrl()', () => {
	test('should return null given an invalid integration', () => {
		const result = sync.getAssociateUrl(
			'helloworld',
			{
				appId: 'xxxxx',
			},
			'user-jellyfish',
			{
				origin: 'https://jel.ly.fish/oauth/helloworld',
			},
		);

		expect(result).toBe(null);
	});

	test('should return null given no token', () => {
		const result = sync.getAssociateUrl('outreach', null, 'user-jellyfish', {
			origin: 'https://jel.ly.fish/oauth/outreach',
		});

		expect(result).toBeFalsy();
	});

	test('should return null given no appId', () => {
		const result = sync.getAssociateUrl(
			'outreach',
			{
				api: 'xxxxxx',
			},
			'user-jellyfish',
			{
				origin: 'https://jel.ly.fish/oauth/outreach',
			},
		);

		expect(result).toBeFalsy();
	});
});

describe('.authorize()', () => {
	const makeSyncActionContextStub = () => ({} as any as SyncActionContext);
	const syncInstanceWithIntegration = new Sync({
		integrationsDefinitions: {
			helloworld: {} as any as IntegrationDefinition,
		},
	});

	test('should throw given an invalid integration', async () => {
		expect.assertions(1);
		await expect(
			sync.authorize(
				'helloworld',
				{
					appId: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
					appSecret: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
				},
				makeSyncActionContextStub(),
				{
					code: '12345',
					origin: 'https://jel.ly.fish/oauth/helloworld',
				},
			),
		).rejects.toThrow(errors.SyncNoCompatibleIntegration);
	});

	test('should throw given no token', async () => {
		expect.assertions(1);
		await expect(
			syncInstanceWithIntegration.authorize(
				'helloworld',
				null,
				makeSyncActionContextStub(),
				{
					code: '12345',
					origin: 'https://jel.ly.fish/oauth/helloworld',
				},
			),
		).rejects.toThrow(errors.SyncNoIntegrationAppCredentials);
	});

	test('should throw given no appId', async () => {
		expect.assertions(1);
		await expect(
			syncInstanceWithIntegration.authorize(
				'helloworld',
				{
					appSecret: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
				},
				makeSyncActionContextStub(),
				{
					code: '12345',
					origin: 'https://jel.ly.fish/oauth/helloworld',
				},
			),
		).rejects.toThrow(errors.SyncNoIntegrationAppCredentials);
	});

	test('should throw given no appSecret', async () => {
		expect.assertions(1);
		await expect(
			syncInstanceWithIntegration.authorize(
				'helloworld',
				{
					appId: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
				},
				makeSyncActionContextStub(),
				{
					code: '12345',
					origin: 'https://jel.ly.fish/oauth/helloworld',
				},
			),
		).rejects.toThrow(errors.SyncNoIntegrationAppCredentials);
	});
});

describe('.associate()', () => {
	const makeSyncContextStub = (data: any) =>
		({
			upsertElement: async (type: string, object: any, _options: any) => {
				data[object.slug] = Object.assign({}, object, {
					type,
				});
			},
		} as any as SyncActionContext);

	test('should throw given an invalid integration', async () => {
		const data = {
			'user-johndoe': {
				active: true,
				capabilities: [],
				created_at: '2021-03-24T14:47:33.126Z',
				data: {
					email: 'johndoe@test.com',
				},
				id: 'a023a3c0-7a06-45b5-8b86-7c8ae141452e',
				markers: [],
				requires: [],
				slug: 'user-johndoe',
				tags: [],
				type: 'user',
				updated_at: null,
				version: '1.0.0',
			},
		};

		await expect(
			sync.associate(
				'helloworld',
				data['user-johndoe'],
				{
					token_type: 'Bearer',
					access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
				},
				makeSyncContextStub(data),
			),
		).rejects.toThrow(errors.SyncNoCompatibleIntegration);
	});

	test('should set the access token in the user card', async () => {
		const data = {
			'user-johndoe': {
				active: true,
				capabilities: [],
				created_at: '2021-03-24T14:47:33.126Z',
				data: {
					email: 'johndoe@test.com',
				},
				id: 'a023a3c0-7a06-45b5-8b86-7c8ae141452e',
				markers: [],
				requires: [],
				slug: 'user-johndoe',
				tags: [],
				type: 'user',
				updated_at: null,
				version: '1.0.0',
			},
		};

		const syncInstance = new Sync({
			integrationsDefinitions: {
				helloworld: {} as any as IntegrationDefinition,
			},
		});

		await syncInstance.associate(
			'helloworld',
			data['user-johndoe'],
			{
				token_type: 'Bearer',
				access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
			},
			makeSyncContextStub(data),
		);

		expect(data['user-johndoe']).toEqual({
			...data['user-johndoe'],
			data: {
				email: 'johndoe@test.com',
				oauth: {
					helloworld: {
						token_type: 'Bearer',
						access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
					},
				},
			},
		});
	});

	test('should not replace other integrations', async () => {
		const data = {
			'user-johndoe': {
				active: true,
				capabilities: [],
				created_at: '2021-03-24T14:47:33.126Z',
				data: {
					email: 'johndoe@test.com',
					oauth: {
						'other-integration': {
							token_type: 'Bearer',
							access_token: 'HjShbdbsd+Ehi2kV/723ib4njksndrtv',
						},
					},
				},
				id: 'a023a3c0-7a06-45b5-8b86-7c8ae141452e',
				markers: [],
				requires: [],
				slug: 'user-johndoe',
				tags: [],
				type: 'user',
				updated_at: null,
				version: '1.0.0',
			},
		};

		const syncInstance = new Sync({
			integrationsDefinitions: {
				helloworld: {} as any as IntegrationDefinition,
			},
		});

		await syncInstance.associate(
			'helloworld',
			data['user-johndoe'],
			{
				token_type: 'Bearer',
				access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
			},
			makeSyncContextStub(data),
		);

		expect(data['user-johndoe']).toEqual({
			...data['user-johndoe'],
			data: {
				email: 'johndoe@test.com',
				oauth: {
					'other-integration': {
						token_type: 'Bearer',
						access_token: 'HjShbdbsd+Ehi2kV/723ib4njksndrtv',
					},
					helloworld: {
						token_type: 'Bearer',
						access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
					},
				},
			},
		});
	});

	test('should replace previous integration data', async () => {
		const data = {
			'user-johndoe': {
				active: true,
				capabilities: [],
				created_at: '2021-03-24T14:47:33.126Z',
				data: {
					email: 'johndoe@test.com',
					oauth: {
						helloworld: {
							token_type: 'Bearer',
							access_token: 'HjShbdbsd+Ehi2kV/723ib4njksndrtv',
						},
					},
				},
				id: 'a023a3c0-7a06-45b5-8b86-7c8ae141452e',
				markers: [],
				requires: [],
				slug: 'user-johndoe',
				tags: [],
				type: 'user',
				updated_at: null,
				version: '1.0.0',
			},
		};

		const syncInstance = new Sync({
			integrationsDefinitions: {
				helloworld: {} as any as IntegrationDefinition,
			},
		});

		await syncInstance.associate(
			'helloworld',
			data['user-johndoe'],
			{
				token_type: 'Bearer',
				access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
			},
			makeSyncContextStub(data),
		);

		expect(data['user-johndoe']).toEqual({
			...data['user-johndoe'],
			data: {
				email: 'johndoe@test.com',
				oauth: {
					helloworld: {
						token_type: 'Bearer',
						access_token: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
					},
				},
			},
		});
	});
});

const setupBalenaCloudInterceptors = (
	expectedAccessToken: string,
	expectedRefreshToken: string,
) => {
	nock.disableNetConnect();
	nock('https://api.balena-cloud.com')
		.post('/oauth/token')
		.reply((_uri, request, callback) => {
			const body = querystring.decode(request as string);

			if (
				_.isEqual(body, {
					grant_type: 'refresh_token',
					client_id: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
					client_secret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
					redirect_uri: 'https://jel.ly.fish/oauth/balena-cloud',
					refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
				})
			) {
				return callback(null, [
					200,
					{
						access_token:
							expectedAccessToken || 'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
						refresh_token:
							expectedRefreshToken || 'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
						token_type: 'bearer',
						expires_in: 3600,
						scope: 'users',
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
		})
		.persist()
		.get('/users/41')
		.reply(function (_uri, _request, callback) {
			if (
				this.req.headers.authorization ===
				`Bearer ${expectedAccessToken || 'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh'}`
			) {
				return callback(null, [
					200,
					{
						id: 41,
						name: 'johndoe',
					},
				]);
			}

			return callback(null, [401, 'Invalid access token']);
		});
};

beforeEach(() => {
	nock.cleanAll();
});

afterAll(() => {
	nock.cleanAll();
});

const oAuthTokenRefreshTestIntegration: IntegrationDefinition = {
	OAUTH_BASE_URL: 'https://api.balena-cloud.com',
	OAUTH_SCOPES: ['users'],

	initialize: async (options: IntegrationInitializationOptions) =>
		new OAuthTokenRefreshTestIntegration(options),

	isEventValid: () => true,
};

class OAuthTokenRefreshTestIntegration implements Integration {
	options: IntegrationInitializationOptions;
	context: any;

	constructor(options: IntegrationInitializationOptions) {
		this.options = options;
		this.context = this.options.context;
	}

	async translate(_event: any, options: { actor: string }) {
		const result = await this.context.request(options.actor, {
			method: 'GET',
			baseUrl: 'https://api.balena-cloud.com',
			json: true,
			uri: '/users/41',
		});
		return [result];
	}

	async mirror() {
		return [];
	}

	async getFile() {
		return Buffer.from('hello world', 'utf8');
	}

	async destroy() {
		return Bluebird.resolve();
	}
}

const getElementBySlugFromCollection = async (data: any, slug: string) => {
	const [base, version] = slug.split('@');

	if (version !== 'latest') {
		return _.find(_.values(data), {
			slug: base,
			version,
		});
	}

	return _.last(
		_.sortBy(
			_.filter(_.values(data), {
				slug: base,
			}),
			['version'],
		),
	);
};

describe('instance', () => {
	test('should be able to refresh an expired OAuth token and retry if needed', async () => {
		setupBalenaCloudInterceptors(
			'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
			'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				version: '1.0.0',
				type: 'user',
				slug: 'user-synctest',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		};

		const results = await sync.executeIntegration(
			oAuthTokenRefreshTestIntegration,
			{
				token: {
					appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
					appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
				},
				actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				defaultUser: 'bar',
				origin: 'https://jel.ly.fish/oauth/balena-cloud',
				provider: 'balena-cloud',
				syncActionContext: {
					logger: {
						info: _.noop,
						warn: _.noop,
						debug: _.noop,
					},
					getElementById: async (id: string) => {
						return data[id] as Contract;
					},
					upsertElement: async (type: string, object: any) => {
						data[object.id] = { ...object, type };
						return data[object.id] as Contract;
					},
				} as any as SyncActionContext,
			},
			'translate',
			{} as any as Contract,
		);

		expect(results).toEqual([
			{
				code: 200,
				body: {
					id: 41,
					name: 'johndoe',
				},
			},
		]);

		expect(data).toEqual({
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
							scope: 'users',
						},
					},
				},
			},
		});
	});

	test('should be able to refresh an expired OAuth token and retry if needed using the default user', async () => {
		setupBalenaCloudInterceptors(
			'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
			'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
			'ecc47582-bc08-45dc-ac8b-16072a843835': {
				id: 'ecc47582-bc08-45dc-ac8b-16072a843835',
				type: 'user',
				slug: 'user-jellysync',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		};

		const results = await sync.executeIntegration(
			oAuthTokenRefreshTestIntegration,
			{
				token: {
					appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
					appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
				},
				origin: 'https://jel.ly.fish/oauth/balena-cloud',
				actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				defaultUser: 'jellysync',
				provider: 'balena-cloud',
				syncActionContext: {
					logger: {
						info: _.noop,
						warn: _.noop,
						debug: _.noop,
					},
					getElementById: async (id: string) => {
						return data[id] as Contract;
					},
					getElementBySlug: async (slug: any) => {
						return getElementBySlugFromCollection(data, slug);
					},
					upsertElement: async (type: string, object: any) => {
						data[object.id] = { ...object, type };
						return data[object.id] as Contract;
					},
				} as any as SyncActionContext,
			},
			'translate',
			{} as any as Contract,
		);

		expect(results).toEqual([
			{
				code: 200,
				body: {
					id: 41,
					name: 'johndoe',
				},
			},
		]);

		expect(data).toEqual({
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
			'ecc47582-bc08-45dc-ac8b-16072a843835': {
				id: 'ecc47582-bc08-45dc-ac8b-16072a843835',
				type: 'user',
				slug: 'user-jellysync',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
							scope: 'users',
						},
					},
				},
			},
		});
	});

	test('should not refresh an OAuth token if not needed', async () => {
		setupBalenaCloudInterceptors(
			'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
			'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		};

		const results = await sync.executeIntegration(
			oAuthTokenRefreshTestIntegration,
			{
				token: {
					appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
					appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
				},
				origin: 'https://jel.ly.fish/oauth/balena-cloud',
				actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				defaultUser: 'bar',
				provider: 'balena-cloud',
				syncActionContext: {
					logger: {
						info: _.noop,
						warn: _.noop,
						debug: _.noop,
					},
					getElementById: async (id: string) => {
						return data[id] as Contract;
					},
					getElementBySlug: async (slug: any) => {
						return getElementBySlugFromCollection(data, slug);
					},
					upsertElement: async (type: string, object: any) => {
						data[object.id] = { ...object, type };
						return data[object.id] as Contract;
					},
				} as any as SyncActionContext,
			},
			'translate',
			{} as any as Contract,
		);

		expect(results).toEqual([
			{
				code: 200,
				body: {
					id: 41,
					name: 'johndoe',
				},
			},
		]);

		expect(data).toEqual({
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		});
	});

	test('should not refresh an OAuth token if not needed when using the default user', async () => {
		setupBalenaCloudInterceptors(
			'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
			'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
			'ecc47582-bc08-45dc-ac8b-16072a843835': {
				id: 'ecc47582-bc08-45dc-ac8b-16072a843835',
				type: 'user',
				slug: 'user-jellysync',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		};

		const results = await sync.executeIntegration(
			oAuthTokenRefreshTestIntegration,
			{
				token: {
					appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
					appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
				},
				actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				origin: 'https://jel.ly.fish/oauth/balena-cloud',
				defaultUser: 'jellysync',
				provider: 'balena-cloud',
				syncActionContext: {
					logger: {
						info: _.noop,
						warn: _.noop,
						debug: _.noop,
					},
					getElementById: async (id: string) => {
						return data[id] as Contract;
					},
					getElementBySlug: async (slug: any) => {
						return getElementBySlugFromCollection(data, slug);
					},
					upsertElement: async (type: string, object: any) => {
						data[object.id] = { ...object, type };
						return data[object.id] as Contract;
					},
				} as any as SyncActionContext,
			},
			'translate',
			{} as any as Contract,
		);

		expect(results).toEqual([
			{
				code: 200,
				body: {
					id: 41,
					name: 'johndoe',
				},
			},
		]);

		expect(data).toEqual({
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
			'ecc47582-bc08-45dc-ac8b-16072a843835': {
				id: 'ecc47582-bc08-45dc-ac8b-16072a843835',
				type: 'user',
				slug: 'user-jellysync',
				version: '1.0.0',
				data: {
					oauth: {
						'balena-cloud': {
							access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
							token_type: 'bearer',
							expires_in: 3600,
							refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
							scope: 'users',
						},
					},
				},
			},
		});
	});

	test('should throw if actor is not associated with the service and there is no default user', async () => {
		setupBalenaCloudInterceptors(
			'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
			'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
		};

		await expect(
			sync.executeIntegration(
				oAuthTokenRefreshTestIntegration,
				{
					token: {
						appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
						appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
					},
					origin: 'https://jel.ly.fish/oauth/balena-cloud',
					provider: 'balena-cloud',
					actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
					defaultUser: '',
					syncActionContext: {
						logger: {
							info: _.noop,
							warn: _.noop,
							debug: _.noop,
						},
						getElementById: async (id: string) => {
							return data[id] as Contract;
						},
						getElementBySlug: async (slug: any) => {
							return getElementBySlugFromCollection(data, slug);
						},
						upsertElement: async (type: string, object: any) => {
							data[object.id] = { ...object, type };
							return data[object.id] as Contract;
						},
					} as any as SyncActionContext,
				},
				'translate',
				{} as any as Contract,
			),
		).rejects.toThrow(errors.SyncOAuthNoUserError);
	});

	test('should throw if actor is not associated with service and the default user is invalid', async () => {
		setupBalenaCloudInterceptors(
			'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
			'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
		};

		await expect(
			sync.executeIntegration(
				oAuthTokenRefreshTestIntegration,
				{
					token: {
						appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
						appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
					},
					origin: 'https://jel.ly.fish/oauth/balena-cloud',
					provider: 'balena-cloud',
					actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
					defaultUser: 'jellysync',
					syncActionContext: {
						logger: {
							info: _.noop,
							warn: _.noop,
							debug: _.noop,
						},
						getElementById: async (id: string) => {
							return data[id] as Contract;
						},
						getElementBySlug: async (slug: any) => {
							return getElementBySlugFromCollection(data, slug);
						},
						upsertElement: async (type: string, object: any) => {
							data[object.id] = { ...object, type };
							return data[object.id] as Contract;
						},
					} as any as SyncActionContext,
				},
				'translate',
				{} as any as Contract,
			),
		).rejects.toThrow(errors.SyncNoActor);
	});

	test('should throw if neither the actor nor the default user are associated with the service', async () => {
		setupBalenaCloudInterceptors(
			'xgrdUPAZ+nZfz91uxB4Qhv1oDpDp1oQh',
			'hQLGLkzZJ4ft3GLP63Z/ruA8o5YeJNsk3I',
		);

		const data: { [key: string]: Partial<Contract> } = {
			'b5fc8487-cd6b-46aa-84ec-2407d5989e92': {
				id: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
				type: 'user',
				slug: 'user-synctest',
				version: '1.0.0',
				data: {},
			},
			'ecc47582-bc08-45dc-ac8b-16072a843835': {
				id: 'ecc47582-bc08-45dc-ac8b-16072a843835',
				type: 'user',
				slug: 'user-jellysync',
				version: '1.0.0',
				data: {},
			},
		};

		await expect(
			sync.executeIntegration(
				oAuthTokenRefreshTestIntegration,
				{
					token: {
						appId: '1T+8uJdHUEzAHz5Z84+tg3HtipfEbzdsXbMmWAnI',
						appSecret: '7Fj+Rf1p/fgXTLR505noNwoq7btJaY8KLyIJWE/r',
					},
					defaultUser: 'jellysync',
					actor: 'b5fc8487-cd6b-46aa-84ec-2407d5989e92',
					origin: 'https://jel.ly.fish/oauth/balena-cloud',
					provider: 'balena-cloud',
					syncActionContext: {
						logger: {
							info: _.noop,
							warn: _.noop,
							debug: _.noop,
						},
						getElementById: async (id: string) => {
							return data[id] as Contract;
						},
						getElementBySlug: async (slug: any) => {
							return getElementBySlugFromCollection(data, slug);
						},
						upsertElement: async (type: string, object: any) => {
							data[object.id] = { ...object, type };
							return data[object.id] as Contract;
						},
					} as any as SyncActionContext,
				},
				'translate',
				{} as any as Contract,
			),
		).rejects.toThrow(errors.SyncOAuthNoUserError);
	});
});
