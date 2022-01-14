import * as errors from './errors';
import { Sync } from '.';
import type { SyncActionContext } from './sync-context';
import type { IntegrationConstructor } from './types';

const sync = new Sync({
	integrations: {},
});

describe('.isValidEvent()', () => {
	test('should return false for an unknown integration', async () => {
		const result = await sync.isValidEvent(
			'helloworld',
			null,
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
		integrations: {
			helloworld: {} as any as IntegrationConstructor,
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
			integrations: {
				helloworld: {} as any as IntegrationConstructor,
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
			integrations: {
				helloworld: {} as any as IntegrationConstructor,
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
			integrations: {
				helloworld: {} as any as IntegrationConstructor,
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
