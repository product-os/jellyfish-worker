import { testUtils as autumndbTestUtils } from 'autumndb';
import { google } from 'googleapis';
import sinon from 'sinon';
import { testUtils, WorkerContext } from '../../../lib';
import { actionGoogleMeet } from '../../../lib/actions/action-google-meet';
import { makeHandlerRequest } from './helpers';

const handler = actionGoogleMeet.handler;
const conferenceUrl = 'http://foo.bar';
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

beforeEach(() => {
	sinon.restore();
});

/**
 * @summary Stub Google API
 * @function
 *
 * @param data - data to return from Google client request
 */
function stub(data: any): void {
	sinon.stub(google.auth, 'GoogleAuth').callsFake(() => {
		return {
			getClient: () => {
				return {
					request: () => {
						return {
							data,
						};
					},
				};
			},
		};
	});
}

describe('action-google-meet', () => {
	test('should throw on missing hangout link', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			autumndbTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		stub({
			id: autumndbTestUtils.generateRandomId(),
		});

		const message = await ctx.createMessage(
			ctx.adminUserId,
			ctx.session,
			supportThread,
			autumndbTestUtils.generateRandomSlug(),
		);
		await expect(
			handler(
				ctx.session,
				actionContext,
				message,
				makeHandlerRequest(ctx, actionGoogleMeet.contract),
			),
		).rejects.toThrow(
			new Error("Meet/Hangout Link not found in the event's body"),
		);
	});

	test('should throw on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			autumndbTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		stub({
			hangoutLink: conferenceUrl,
			id: autumndbTestUtils.generateRandomId(),
		});

		const message = await ctx.createMessage(
			ctx.adminUserId,
			ctx.session,
			supportThread,
			autumndbTestUtils.generateRandomSlug(),
		);
		message.type = 'foobar';
		await expect(
			handler(
				ctx.session,
				actionContext,
				message,
				makeHandlerRequest(ctx, actionGoogleMeet.contract),
			),
		).rejects.toThrow(new Error(`No such type: ${message.type}`));
	});

	test('should update the card with the conference URL', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			autumndbTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		stub({
			hangoutLink: 'https://meet.google.com',
			id: autumndbTestUtils.generateRandomId(),
		});

		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-google-meet@1.0.0',
				context: ctx.logContext,
				card: supportThread.id,
				type: supportThread.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				input: {
					id: supportThread.id,
				},
				arguments: {},
			},
		});

		const [updatedCard] = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: supportThread.type,
				},
				id: {
					type: 'string',
					const: supportThread.id,
				},
			},
		});

		expect(
			(updatedCard.data as any).conferenceUrl.startsWith(
				'https://meet.google.com',
			),
		).toBe(true);
	});
});
