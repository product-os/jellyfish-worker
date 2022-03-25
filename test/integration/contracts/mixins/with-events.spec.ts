import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { contractMixins, PluginDefinition, testUtils } from '../../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	const foobarPlugin = (): PluginDefinition => {
		return {
			slug: 'plugin-foobar',
			name: 'Test Plugin',
			version: '1.0.0',
			contracts: [
				contractMixins.mixin(contractMixins.withEvents('foo', 'type@1.0.0'))({
					slug: 'foo',
					name: 'Foo',
					type: 'type@1.0.0',
					data: {
						schema: {
							type: 'object',
							properties: {
								name: {
									type: ['string', 'null'],
								},
								data: {
									type: 'object',
								},
							},
						},
					},
				}),
				{
					slug: 'bar',
					name: 'Bar',
					type: 'type@1.0.0',
					data: {
						schema: {
							type: 'object',
							properties: {
								name: {
									type: ['string', 'null'],
								},
								data: {
									type: 'object',
									properties: {
										actor: {
											type: 'string',
											format: 'uuid',
										},
										payload: {
											type: 'object',
											properties: {
												mentionsUser: {
													type: 'array',
													items: {
														type: 'string',
													},
												},
												alertsUser: {
													type: 'array',
													items: {
														type: 'string',
													},
												},
												mentionsGroup: {
													type: 'array',
													items: {
														type: 'string',
													},
												},
												alertsGroup: {
													type: 'array',
													items: {
														type: 'string',
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			],
		};
	};

	ctx = await testUtils.newContext({
		plugins: [foobarPlugin()],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('with-events mixin', () => {
	test('formulas work as expected', async () => {
		const username = autumndbTestUtils.generateRandomId();
		const testUser = await ctx.createUser(username);
		const testSession = await ctx.createSession(testUser);

		// Create initial contract
		const foo = await ctx.worker.insertCard(
			ctx.logContext,
			testSession.id,
			ctx.worker.typeContracts['foo@1.0.0'],
			{
				attachEvents: true,
				actor: testUser.id,
			},
			{
				name: 'foo-1',
			},
		);
		assert(foo);

		// Add an event
		const bar = await ctx.createEvent(
			testUser.id,
			testSession.id,
			foo,
			'test',
			'bar',
		);

		// Set a few properties on event
		const updated = await ctx.worker.patchCard(
			ctx.logContext,
			testSession.id,
			ctx.worker.typeContracts['bar@1.0.0'],
			{
				actor: testUser.id,
				attachEvents: true,
			},
			bar,
			[
				{
					op: 'add',
					path: '/data/payload/mentionsUser',
					value: [autumndbTestUtils.generateRandomId()],
				},
				{
					op: 'add',
					path: '/data/payload/alertsUser',
					value: [autumndbTestUtils.generateRandomId()],
				},
				{
					op: 'add',
					path: '/data/payload/mentionsGroup',
					value: [autumndbTestUtils.generateRandomId()],
				},
				{
					op: 'add',
					path: '/data/payload/alertsGroup',
					value: [autumndbTestUtils.generateRandomId()],
				},
			],
		);
		assert(updated);

		// Trigger formula execution
		await ctx.worker.patchCard(
			ctx.logContext,
			testSession.id,
			ctx.worker.typeContracts['foo@1.0.0'],
			{
				actor: testUser.id,
				attachEvents: true,
			},
			foo,
			[
				{
					op: 'replace',
					path: '/name',
					value: 'foo-2',
				},
			],
		);

		// Get updated initial contract
		const match = await ctx.waitForMatch({
			additionalProperties: true,
			$$links: {
				'has attached element': {
					type: 'object',
					required: ['id'],
					properties: {
						id: {
							type: 'string',
							const: bar.id,
						},
					},
				},
			},
		});

		const picks = [
			'participants',
			'mentionsUser',
			'alertsUser',
			'mentionsGroup',
			'alertsGroup',
		];
		expect(_.pick(match.data, picks)).toEqual({
			..._.pick(updated.data.payload, picks),
			participants: [updated.data.actor],
		});
	});
});
