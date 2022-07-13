import { strict as assert } from 'assert';
import type { UserContract } from 'autumndb';
import { ActionRequestContract, testUtils } from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

// Runs the action-maintain-contact action and returns the resulting contact contract
const maintainContact = async (userContract: UserContract) => {
	const actionRequest = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['action-request@1.0.0'],
		{
			attachEvents: false,
			timestamp: new Date().toISOString(),
		},
		{
			type: 'action-request@1.0.0',
			data: {
				action: 'action-maintain-contact@1.0.0',
				context: ctx.logContext,
				card: userContract.id,
				type: userContract.type,
				actor: ctx.adminUserId,
				epoch: new Date().valueOf(),
				input: {
					id: userContract.id,
				},
				timestamp: new Date().toISOString(),
				arguments: {},
			},
		},
	);
	assert(actionRequest);

	await ctx.flush(ctx.session);

	const result: any = await ctx.worker.producer.waitResults(
		ctx.logContext,
		actionRequest as ActionRequestContract,
	);

	expect(result.error).toBe(false);

	assert(result.data);

	const contactContract = await ctx.kernel.getContractBySlug(
		ctx.logContext,
		ctx.session,
		`${result.data.slug}@1.0.0`,
	);

	return contactContract;
};

describe('action-maintain-contact', () => {
	it('should elevate external event source', async () => {
		const origin = await ctx.kernel.insertContract(
			ctx.logContext,
			ctx.session,
			{
				type: 'card@1.0.0',
				data: {
					source: 'my-fake-service',
				},
			},
		);

		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
					origin: origin.id,
					profile: {
						name: {
							first: 'John',
							last: 'Doe',
						},
					},
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);
		assert(contactContract !== null);

		expect(contactContract.data).toEqual({
			origin: origin.id,
			source: 'my-fake-service',
			profile: {
				email: 'johndoe@example.com',
				name: {
					first: 'John',
					last: 'Doe',
				},
			},
		});
	});

	it('should prettify name when creating user contact', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						name: {
							first: 'john   ',
							last: '  dOE ',
						},
					},
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);
		assert(contactContract !== null);

		expect((contactContract.data.profile as any).name).toEqual({
			first: 'John',
			last: 'Doe',
		});
	});

	it('should link the contact to the user', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
				},
			},
		);
		assert(userContract);

		const contact = await maintainContact(userContract);

		assert(contact !== null);

		const [result] = await ctx.kernel.query(ctx.logContext, ctx.session, {
			$$links: {
				'has contact': {
					type: 'object',
				},
			},
			type: 'object',
			required: ['id', 'type', 'links'],
			properties: {
				id: {
					type: 'string',
					const: userContract.id,
				},
			},
		});

		assert(result !== undefined);
		expect(result.links!['has contact'][0].id).toBe(contact.id);
	});

	it('should be able to sync updates to user first names', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						title: 'Frontend Engineer',
						name: {
							first: 'John',
						},
					},
				},
			},
		);
		assert(userContract);

		await maintainContact(userContract);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'replace',
					value: 'Johnny',
					path: '/data/profile/name/first',
				},
			],
		);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.data.profile).toEqual({
			email: 'johndoe@example.com',
			title: 'Frontend Engineer',
			name: {
				first: 'Johnny',
			},
		});
	});

	it('should apply a user patch to a contact that diverged', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						title: 'Frontend Engineer',
					},
				},
			},
		);
		assert(userContract);

		const result1 = await maintainContact(userContract);

		assert(result1 !== null);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${result1.slug}@${result1.version}`,
			[
				{
					op: 'remove',
					path: '/data/profile/title',
				},
			],
		);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'replace',
					path: '/data/profile/title',
					value: 'Senior Frontend Engineer',
				},
			],
		);

		const result = await maintainContact(userContract);

		assert(result !== null);

		expect((result.data.profile as any).title).toBe('Senior Frontend Engineer');
	});

	it('should update the name of existing contact', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						title: 'Frontend Engineer',
					},
				},
			},
		);
		assert(userContract);

		await maintainContact(userContract);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'replace',
					path: '/name',
					value: 'John Doe',
				},
			],
		);

		const result = await maintainContact(userContract);

		assert(result !== null);

		expect(result.name).toBe('John Doe');
	});

	it('should delete an existing contact if the user is deleted', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						title: 'Frontend Engineer',
					},
				},
			},
		);
		assert(userContract);

		await maintainContact(userContract);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'replace',
					value: false,
					path: '/active',
				},
			],
		);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.active).toBe(false);
	});

	it('should not remove a property from an existing linked contact', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					roles: ['user-community'],
					hash: 'PASSWORDLESS',
					profile: {
						title: 'Frontend Engineer',
					},
				},
			},
		);
		assert(userContract);

		await maintainContact(userContract);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'remove',
					path: '/data/profile/title',
				},
			],
		);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect((contactContract.data.profile as any).title).toBe(
			'Frontend Engineer',
		);
	});

	it('should add a property to an existing linked contact', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);
		assert(userContract);

		await maintainContact(userContract);

		await ctx.kernel.patchContractBySlug(
			ctx.logContext,
			ctx.session,
			`${userContract.slug}@${userContract.version}`,
			[
				{
					op: 'add',
					path: '/data/profile',
					value: {},
				},
				{
					op: 'add',
					path: '/data/profile/company',
					value: 'Balena',
				},
			],
		);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.data.profile).toEqual({
			email: 'johndoe@example.com',
			company: 'Balena',
			name: {},
		});
	});

	it('should create a contact for a user with little profile info', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.data).toEqual({
			profile: {
				email: 'johndoe@example.com',
				name: {},
			},
		});
	});

	it('should use the user name when creating a contact', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				name: 'John Doe',
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.name).toBe('John Doe');
	});

	it('should create an inactive contact given an inactive user', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				active: false,
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.active).toBe(false);
	});

	it('should create a contact for a user with plenty of info', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
					profile: {
						company: 'Balena.io',
						title: 'Senior Directory of the Jellyfish Task Force',
						type: 'professional',
						country: 'Republic of Balena',
						city: 'Contractshire',
						name: {
							first: 'John',
							last: 'Doe',
						},
					},
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect(contactContract.data.profile).toEqual({
			email: 'johndoe@example.com',
			company: 'Balena.io',
			title: 'Senior Directory of the Jellyfish Task Force',
			country: 'Republic of Balena',
			city: 'Contractshire',
			type: 'professional',
			name: {
				first: 'John',
				last: 'Doe',
			},
		});
	});

	it('should create a contact for a user with multiple emails', async () => {
		const userContract = await ctx.kernel.insertContract<UserContract>(
			ctx.logContext,
			ctx.session,
			{
				type: 'user@1.0.0',
				data: {
					email: ['johndoe@example.com', 'johndoe@gmail.com'],
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
					profile: {
						name: {
							first: 'John',
							last: 'Doe',
						},
					},
				},
			},
		);
		assert(userContract);

		const contactContract = await maintainContact(userContract);

		assert(contactContract !== null);

		expect((contactContract.data.profile as any).email).toEqual([
			'johndoe@example.com',
			'johndoe@gmail.com',
		]);
	});
});
