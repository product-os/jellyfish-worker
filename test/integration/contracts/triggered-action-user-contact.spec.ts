import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('The contact is updated when the user is updated', async () => {
	const username = autumndbTestUtils.generateRandomId();

	const inserted = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			name: username,
			slug: autumndbTestUtils.generateRandomSlug({
				prefix: 'user',
			}),
			version: '1.0.0',
			markers: [],
			data: {
				email: `${username}@example.com`,
				roles: ['user-community'],
			},
		},
	);
	assert(inserted);
	await ctx.flushAll(ctx.session);
	const user = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		inserted.id,
	);

	assert(user);

	const name = 'Johnny';

	await ctx.flushAll(ctx.session);

	const contact: any = await ctx.waitForMatch({
		$$links: {
			'is attached to user': {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						const: user.id,
					},
				},
			},
		},
		type: 'object',
		properties: {
			type: {
				type: 'string',
				const: 'contact@1.0.0',
			},
		},
	});

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		user,
		[
			{
				op: 'add',
				path: '/data/profile',
				value: {
					name: {
						first: name,
					},
				},
			},
		],
	);

	await ctx.flushAll(ctx.session);

	const updated: any = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		contact.id,
	);

	expect(updated.data.profile.name.first).toBe(name);
});

test('The contact is updated when user tags are updated', async () => {
	// Insert a new user and check that a contact is created.
	const username = autumndbTestUtils.generateRandomId();
	const firstTag = 'foo';
	let user = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			name: username,
			slug: autumndbTestUtils.generateRandomSlug({
				prefix: 'user',
			}),
			version: '1.0.0',
			markers: [],
			data: {
				email: `${username}@example.com`,
				roles: ['user-community'],
			},
			tags: [firstTag],
		},
	);
	assert(user);
	await ctx.flushAll(ctx.session);
	let contact: any = await ctx.waitForMatch({
		$$links: {
			'is attached to user': {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						const: user.id,
					},
				},
			},
		},
		type: 'object',
		properties: {
			type: {
				type: 'string',
				const: 'contact@1.0.0',
			},
		},
	});
	expect(contact.tags).toStrictEqual([firstTag]);

	// Add another tag to the user and wait for the contact to be updated.
	const secondTag = 'bar';
	user = await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		user,
		[
			{
				op: 'add',
				path: '/tags/1',
				value: secondTag,
			},
		],
	);
	assert(user);
	await ctx.flushAll(ctx.session);
	contact = await ctx.waitForMatch({
		$$links: {
			'is attached to user': {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						const: user.id,
					},
				},
			},
		},
		type: 'object',
		properties: {
			type: {
				type: 'string',
				const: 'contact@1.0.0',
			},
			tags: {
				type: 'array',
				contains: {
					type: 'string',
					const: secondTag,
				},
			},
		},
	});
	expect(contact.tags).toStrictEqual([firstTag, secondTag]);

	// Now remove a tag from the user and check that
	// this change is reflected in the contact.
	user = await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		user,
		[
			{
				op: 'remove',
				path: '/tags/1',
			},
		],
	);
	assert(user);
	await ctx.flushAll(ctx.session);
	contact = await ctx.waitForMatch({
		$$links: {
			'is attached to user': {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						const: user.id,
					},
				},
			},
		},
		type: 'object',
		properties: {
			type: {
				type: 'string',
				const: 'contact@1.0.0',
			},
			tags: {
				type: 'array',
				not: {
					contains: {
						type: 'string',
						const: secondTag,
					},
				},
			},
		},
	});
	expect(contact.tags).toStrictEqual([firstTag]);
});
