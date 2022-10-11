import { Sync } from '../../../lib/sync';
import * as errors from '../../../lib/errors';
import type { SyncActionContext } from '../../../lib/sync/sync-context';
import type { IntegrationDefinition } from '../../../lib/sync/types';

const sync = new Sync({
	integrations: {},
});

describe('.isValidEvent()', () => {
	test('should return false for an unknown integration', async () => {
		const result = await sync.isValidEvent(
			{ id: 'test' },
			'invalid',
			{},
			{
				headers: {},
				raw: '....',
			},
		);

		expect(result).toBe(false);
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

	test('should set the access token in the user contract', async () => {
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
			integrations: {
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
			integrations: {
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
