import { strict as assert } from 'assert';
import { testUtils as autumndbTestUtils } from 'autumndb';
import md5 from 'blueimp-md5';
import { isArray, isNull } from 'lodash';
import nock from 'nock';
import { testUtils } from '../../../lib';
import { actionSetUserAvatar } from '../../../lib/actions/action-set-user-avatar';
import type { WorkerContext } from '../../../lib/types';
import { makeHandlerRequest } from './helpers';

const handler = actionSetUserAvatar.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return testUtils.destroyContext(ctx);
});

afterEach(() => {
	nock.cleanAll();
});

/**
 * Generate random email address
 * @function
 *
 * @returns random email address
 */
function genEmail(): string {
	return `${autumndbTestUtils.generateRandomId()}@foo.bar`;
}

describe('action-set-user-avatar', () => {
	test('should not set avatar if user has no email', async () => {
		const user = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
			},
		);
		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				slug: user.slug,
				version: user.version,
				type: user.type,
			});
		}

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeUndefined();
	});

	test('should not update avatar if already set', async () => {
		const user = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				avatar: autumndbTestUtils.generateRandomId(),
			},
		);

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(user.data.avatar);
	});

	test('should set avatar to null on invalid gravatar URL (single email)', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: genEmail(),
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar to null on invalid gravatar URL (email array)', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar on valid gravatar URL (single email)', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: genEmail(),
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (first email in array)', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[0].trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (second email in array)', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[1].trim())}?d=404`,
		);
	});

	test('should set avatar when current data.avatar is null', async () => {
		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: genEmail(),
				avatar: null,
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionSetUserAvatar.contract),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});

	test('operators should be able to set other users avatars', async () => {
		const operator: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: ['user-community', 'user-operator'],
				email: genEmail(),
				avatar: null,
			},
		);

		const user: any = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			autumndbTestUtils.generateRandomSlug(),
			{
				roles: [],
				email: genEmail(),
				avatar: null,
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const handlerRequest = makeHandlerRequest(
			ctx,
			actionSetUserAvatar.contract,
		);
		handlerRequest.actor = operator.id;
		const result = await handler(
			{ actor: operator },
			actionContext,
			user,
			handlerRequest,
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});
});
