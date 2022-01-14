import { strict } from 'assert';
import _ from 'lodash';
import * as uuid from 'uuid';
import { testUtils } from '../../';

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

test('empty test', async () => {
	expect(1).toEqual(1);
});

describe('context.getElementByMirrorId()', () => {
	test('should match mirrors exactly', async () => {
		const mirrorId = `test://${uuid.v4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
			{
				mirrors: [`test://${uuid.v4()}`],
			},
		);

		const result: any = await actionContext.getElementByMirrorId(
			'card@1.0.0',
			mirrorId,
		);
		expect(result).toEqual(foo);
	});

	test('should match by type', async () => {
		const mirrorId = `test://${uuid.v4()}`;
		const foo = await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'org@1.0.0',
			`card-${uuid.v4()}`,
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
		const mirrorId = `test://${uuid.v4()}`;
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
			{
				mirrors: [mirrorId],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
			{
				mirrors: [`test://${uuid.v4()}`],
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
			`card-${uuid.v4()}`,
			{
				mirrors: ['test://foo/1'],
			},
		);
		await ctx.createContract(
			ctx.adminUserId,
			ctx.worker.session,
			'card@1.0.0',
			`card-${uuid.v4()}`,
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

describe('context.upsertElement()', () => {
	test('should create a new element', async () => {
		const newCard = {
			type: 'card@1.0.0',
			slug: `card-${uuid.v4()}`,
			data: {
				test: 1,
			},
		};

		const result = await actionContext.upsertElement('card@1.0.0', newCard, {
			actor: ctx.adminUserId,
		});
		strict(result);
		expect(result.slug).toBe(newCard.slug);
	});

	test('should patch an element if the slug exists but no id is provided', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `card-${uuid.v4()}`,
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
				slug: `card-${uuid.v4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const newCard = {
			...foo,
			slug: `${foo.slug}-fuzzbuzzfizz`,
			data: {
				test: 2,
			},
		};
		const result = await actionContext.upsertElement('card@1.0.0', newCard, {
			actor: ctx.adminUserId,
		});
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.id).toBe(foo.id);
		expect(result.data.test).toBe(newCard.data.test);
	});

	test('should patch an element by id when the slugs are the same', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `card-${uuid.v4()}`,
				data: {
					test: 1,
				},
			},
			{
				actor: ctx.adminUserId,
			},
		);
		strict(foo);

		const newCard = {
			...foo,
			data: {
				test: 2,
			},
		};
		const result = await actionContext.upsertElement('card@1.0.0', newCard, {
			actor: ctx.adminUserId,
		});
		strict(result);
		expect(result.slug).toBe(foo.slug);
		expect(result.id).toBe(foo.id);
		expect(result.data.test).toBe(newCard.data.test);
	});

	test('should patch an element using a patch object', async () => {
		const foo = await actionContext.upsertElement(
			'card@1.0.0',
			{
				type: 'card@1.0.0',
				slug: `card-${uuid.v4()}`,
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
