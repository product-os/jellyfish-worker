import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import nock from 'nock';
import { testUtils, WorkerContext } from '../../../lib';
import { actionSendEmail } from '../../../lib/actions/action-send-email';
import { includes, makeHandlerRequest } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let mailBody: string = '';
const handler = actionSendEmail.handler;
let ctx: testUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
	actionContext = ctx.worker.getActionContext({
		id: `test-${autumndbTestUtils.generateRandomId()}`,
	});
});

afterEach(() => {
	nock.cleanAll();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

function nockMail() {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200, (_uri: string, sendBody: string) => {
			mailBody = sendBody;
		});
}

describe('action-send-email', () => {
	test('should send an email', async () => {
		nockMail();
		const user = await ctx.createUser('foobar');
		const args = {
			toAddress: 'foo@example.com',
			fromAddress: 'bar@example.com',
			subject: autumndbTestUtils.generateRandomId(),
			html: autumndbTestUtils.generateRandomId(),
		};
		await ctx.processAction(ctx.session, {
			type: 'action-request@1.0.0',
			data: {
				action: 'action-send-email@1.0.0',
				context: ctx.logContext,
				card: user.id,
				type: user.type,
				epoch: new Date().valueOf(),
				timestamp: new Date().toISOString(),
				actor: user.id,
				input: {
					id: user.id,
				},
				arguments: args,
			},
		});

		expect(includes('to', args.toAddress, mailBody)).toBe(true);
		expect(includes('from', args.fromAddress, mailBody)).toBe(true);
		expect(includes('subject', args.subject, mailBody)).toBe(true);
		expect(includes('html', args.html, mailBody)).toBe(true);
	});

	test('should throw an error when the email is invalid', async () => {
		await expect(
			handler(
				ctx.session,
				actionContext,
				{} as any,
				makeHandlerRequest(ctx, actionSendEmail.contract, {
					toAddress: 'foobar',
					fromAddress: 'hello@balena.io',
					subject: 'sending real email',
					html: 'with real text in the body',
				}),
			),
		).rejects.toThrow();
	});
});
