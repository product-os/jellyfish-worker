import { strict } from 'assert';
import { v4 as uuidv4 } from 'uuid';
import { testUtils } from '../../lib';

let ctx: testUtils.TestContext;
let actionContext: any;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.sync!.getActionContext(
		'foobar',
		ctx.worker.getActionContext(ctx.logContext),
		ctx.logContext,
		ctx.worker.session,
	);
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('context.getElementByMirrorId()', () => {
	test('should match mirrors exactly', async () => {
		const mirrorId = `test://${uuidv4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [`test://${uuidv4()}`],
			},
		);

		const result: any = await actionContext.getElementByMirrorId(
			'card@1.0.0',
			mirrorId,
		);
		expect(result).toEqual(foo);
	});

	test('should match by type', async () => {
		const mirrorId = `test://${uuidv4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'org@1.0.0',
			`card-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);

		const result: any = await actionContext.getElementByMirrorId(
			'card@1.0.0',
			mirrorId,
		);
		expect(result).toEqual(foo);
	});

	test('should not return anything if there is no match', async () => {
		const mirrorId = `test://${uuidv4()}`;
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [`test://${uuidv4()}`],
			},
		);

		const result: any = await actionContext.getElementByMirrorId(
			'card@1.0.0',
			'foobarbaz',
		);
		expect(result).toBeFalsy();
	});

	test('should optionally use a pattern match for the mirror Id', async () => {
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: ['test://foo/1'],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: ['test://bar/2'],
			},
		);

		const result: any = await actionContext.getElementByMirrorId(
			'card@1.0.0',
			'foo/1',
			{
				usePattern: true,
			},
		);
		expect(result).toEqual(foo);
	});
});

describe('context.getElementByMirrorIds()', () => {
	test('should match mirrors exactly', async () => {
		const mirrorId = `test://${uuidv4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [`test://${uuidv4()}`],
			},
		);

		const result: any = await actionContext.getElementByMirrorIds(
			'card@1.0.0',
			[mirrorId],
		);
		expect(result).toEqual(foo);
	});

	test('should match by type', async () => {
		const mirrorId = `test://${uuidv4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'org@1.0.0',
			`card-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);

		const result: any = await actionContext.getElementByMirrorIds(
			'card@1.0.0',
			[mirrorId],
		);
		expect(result).toEqual(foo);
	});

	test('should not return anything if there is no match', async () => {
		const mirrorId = `test://${uuidv4()}`;
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`contract-${uuidv4()}`,
			{
				mirrors: [`test://${uuidv4()}`],
			},
		);

		const result: any = await actionContext.getElementByMirrorIds(
			'card@1.0.0',
			['foobarbaz'],
		);
		expect(result).toBeFalsy();
	});
});

describe('context.upsertElement()', () => {
	test('should create a new element', async () => {
		const newContract = {
			type: 'card@1.0.0',
			slug: `contract-${uuidv4()}`,
			data: {
				test: 1,
			},
		};

		const result = await actionContext.upsertElement(
			'card@1.0.0',
			newContract,
			{
				actor: ctx.adminUserId,
			},
		);
		strict(result);
		expect(result.slug).toBe(newContract.slug);
	});

	test('should patch an element if the slug exists but no id is provided', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `contract-${uuidv4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const bar = {
			...foo,
			data: {
				test: 2,
			},
		};
		const result = await actionContext.upsertElement('card@1.0.0', bar, {
			actor: ctx.adminUserId,
		});
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.data.test).toBe(bar.data.test);
	});

	test('should patch an element by id even if the slugs differ', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `contract-${uuidv4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const newContract = {
			...foo,
			slug: `${foo.slug}-fuzzbuzzfizz`,
			data: {
				test: 2,
			},
		};
		const result = await actionContext.upsertElement(
			'card@1.0.0',
			newContract,
			{
				actor: ctx.adminUserId,
			},
		);
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.id).toBe(foo.id);
		expect(result.data.test).toBe(newContract.data.test);
	});

	test('should patch an element by id when the slugs are the same', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `contract-${uuidv4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const newContract = {
			...foo,
			data: {
				test: 2,
			},
		};
		const result = await actionContext.upsertElement(
			'card@1.0.0',
			newContract,
			{
				actor: ctx.adminUserId,
			},
		);
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.id).toBe(foo.id);
		expect(result.data.test).toBe(newContract.data.test);
	});

	test('should patch an element using a patch object', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `contract-${uuidv4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const update = {
			id: foo.id,
			patch: [
				{
					op: 'replace',
					path: '/data/test',
					value: 2,
				},
			],
		};

		const result = await actionContext.upsertElement('card@1.0.0', update, {
			actor: ctx.adminUserId,
		});
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.id).toBe(foo.id);
		expect(result.data.test).toBe(update.patch[0].value);
	});
});

describe('context.getContactByEmail()', () => {
	test('should match emails exactly', async () => {
		const email = 'test@example.com';

		// Insert a decoy
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'contact@1.0.0',
			`contract-${uuidv4()}`,
			{
				profile: {
					email: 'decoy@example.com',
				},
			},
		);

		const contact = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'contact@1.0.0',
			`contract-${uuidv4()}`,
			{
				profile: {
					email,
				},
			},
		);

		const result: any = await actionContext.getContactByEmail(email);
		expect(result).toEqual(contact);
	});
});
