import { strict as assert } from 'assert';
import {
	AutumnDBSession,
	testUtils as autumndbTestUtils,
	UserContract,
} from 'autumndb';
import { isBefore, isValid } from 'date-fns';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let user: UserContract;
let session: AutumnDBSession;

beforeAll(async () => {
	ctx = await testUtils.newContext();

	user = await ctx.createUser(autumndbTestUtils.generateRandomId());
	session = { actor: user };
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

test('editing a message triggers an update to the edited_at field', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session,
		autumndbTestUtils.generateRandomId(),
		{
			status: 'open',
		},
	);
	const update1 = autumndbTestUtils.generateRandomId();
	const update2 = autumndbTestUtils.generateRandomId();

	// Verify that initial the edited_at field is undefined
	const message = await ctx.createMessage(
		user.id,
		session,
		supportThread,
		autumndbTestUtils.generateRandomId(),
	);
	expect(typeof message.data.edited_at).toEqual('undefined');

	// Now update the message text
	await ctx.worker.patchCard(
		ctx.logContext,
		session,
		ctx.worker.typeContracts[message.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		message,
		[
			{
				op: 'replace',
				path: '/data/payload/message',
				value: update1,
			},
		],
	);
	await ctx.flushAll(session);
	let updatedMessage = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message.id,
	);
	assert(updatedMessage);

	// And check that the edited_at field now has a valid date-time value
	const firstEditedAt = new Date(updatedMessage.data.edited_at as string);
	expect(isValid(firstEditedAt)).toBe(true);
	expect((updatedMessage.data as any).payload.message).toEqual(update1);

	// Now modify the message text again
	await ctx.worker.patchCard(
		ctx.logContext,
		session,
		ctx.worker.typeContracts[message.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		message,
		[
			{
				op: 'replace',
				path: '/data/payload/message',
				value: update2,
			},
		],
	);
	await ctx.flushAll(session);
	updatedMessage = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message.id,
	);
	assert(updatedMessage);

	// And check that the edited_at field has been updated again
	const secondEditedAt = new Date(updatedMessage.data.edited_at as string);
	expect(isValid(secondEditedAt)).toBe(true);
	expect((updatedMessage.data as any).payload.message).toEqual(update2);

	expect(isBefore(firstEditedAt, secondEditedAt)).toBe(true);
});

test('updating a meta field in the message payload triggers an update to the edited_at field', async () => {
	const supportThread = await ctx.createSupportThread(
		user.id,
		session,
		autumndbTestUtils.generateRandomId(),
		{
			status: 'open',
		},
	);
	const mentionedUserSlug = autumndbTestUtils.generateRandomSlug({
		prefix: 'user',
	});

	// Verify that initial the edited_at field is undefined
	const message = await ctx.createMessage(
		user.id,
		session,
		supportThread,
		'test',
	);
	expect(typeof message.data.edited_at).toEqual('undefined');

	// Now add a mentionsUser item
	await ctx.worker.patchCard(
		ctx.logContext,
		session,
		ctx.worker.typeContracts[message.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		message,
		[
			{
				op: 'add',
				path: '/data/payload/mentionsUser',
				value: [mentionedUserSlug],
			},
		],
	);

	await ctx.flushAll(session);
	let updatedMessage = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message.id,
	);
	assert(updatedMessage);

	// And check that the edited_at field now has a valid date-time value
	const firstEditedAt = new Date(updatedMessage.data.edited_at as string);
	expect(isValid(firstEditedAt)).toBe(true);
	expect((updatedMessage.data as any).payload.mentionsUser).toEqual([
		mentionedUserSlug,
	]);

	// Now remove the mentioned user
	await ctx.worker.patchCard(
		ctx.logContext,
		session,
		ctx.worker.typeContracts[message.type],
		{
			attachEvents: true,
			actor: user.id,
		},
		updatedMessage,
		[
			{
				op: 'remove',
				path: '/data/payload/mentionsUser/0',
			},
		],
	);
	await ctx.flushAll(ctx.session);
	updatedMessage = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		message.id,
	);
	assert(updatedMessage);

	// And check that the edited_at field has been updated again
	const secondEditedAt = new Date(updatedMessage.data.edited_at as string);
	expect(isValid(secondEditedAt)).toBe(true);
	expect((updatedMessage.data as any).payload.mentionsUser).toEqual([]);

	expect(isBefore(firstEditedAt, secondEditedAt)).toBe(true);
});
