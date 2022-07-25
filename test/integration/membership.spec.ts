import { testUtils as autumndbTestUtils } from 'autumndb';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('membership', () => {
	test('should automatically make org creator a member', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session = { actor: user };

		const org = await ctx.createContract(
			user.id,
			session,
			'org@1.0.0',
			'Closed org',
			{},
		);

		const [member] = await ctx.kernel.query(
			ctx.logContext,
			session,
			{
				type: 'object',
				properties: {
					id: {
						const: org.id,
					},
				},
				$$links: {
					'has member': {
						type: 'object',
						properties: {
							id: {
								const: user.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(member).toBeDefined();
	});

	test('should allow creating a membership link if the user is a member', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session = { actor: user };

		// Create a closed org
		const org = await ctx.createContract(
			user.id,
			session,
			'org@1.0.0',
			'Closed org',
			{},
		);

		// Use the user session to try and invite themselves to the org by creating a link
		const result = await ctx.createLinkThroughWorker(
			user.id,
			session,
			org,
			user,
			'has member',
			'is member of',
		);

		expect(result).toBeDefined();
	});

	test('should disallow creating a membership link if the user is not a member', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session = { actor: user };

		// Create a closed org
		const org = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'org@1.0.0',
			'Closed org',
			{},
		);

		// Use the user session to try and invite themselves to the org by creating a link
		await expect(() =>
			ctx.createLinkThroughWorker(
				user.id,
				session,
				org,
				user,
				'has member',
				'is member of',
			),
		).rejects.toThrow(/not a member/);
	});

	test('should disallow patching a membership link if the user is not a member', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session = { actor: user };

		// Create a closed org
		const org = await ctx.createContract(
			user.id,
			session,
			'org@1.0.0',
			'Closed org',
			{},
		);

		// Use the user session to try and invite themselves to the org by creating a link
		const link = await ctx.createLinkThroughWorker(
			user.id,
			session,
			org,
			user,
			'has member',
			'is member of',
		);

		const user2 = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session2 = { actor: user2 };

		// Try to patch the link to make user2 a member of the org instead
		await expect(() =>
			ctx.worker.patchCard(
				ctx.logContext,
				session2,
				ctx.worker.typeContracts['link@1.0.0'],
				{
					actor: user2.id,
				},
				link,
				[
					{
						op: 'replace',
						path: '/data/to/id',
						value: user2.id,
					},
				],
			),
		).rejects.toThrow(/not a member/);
	});

	test('should disallow creating a link to imitate contract creation', async () => {
		const user = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session = { actor: user };

		// Create a closed org
		const org = await ctx.createContract(
			user.id,
			session,
			'org@1.0.0',
			'Closed org',
			{},
		);

		const user2 = await ctx.createUser(
			autumndbTestUtils.generateRandomSlug(),
			undefined,
			['user-community'],
		);

		const session2 = { actor: user2 };

		// Try to trick the system by creating a link to the contract as though user2 was the creator
		await expect(() =>
			ctx.createLinkThroughWorker(
				user2.id,
				session2,
				user2,
				org,
				'is creator of',
				'was created by',
			),
		).rejects.toThrow(/Cannot create link with reserved name/);
	});
});
