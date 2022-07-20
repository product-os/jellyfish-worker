import { testUtils as autumndbTestUtils } from 'autumndb';
import _ from 'lodash';
import { setTimeout as delay } from 'timers/promises';
import { testUtils } from '../../../lib';

let ctx: testUtils.TestContext;
let channel: any;
let agent: any;
let customer: any;
let customerSession: any;

beforeAll(async () => {
	ctx = await testUtils.newContext();

    // Create channel
    channel = await ctx.createContract(
        ctx.adminUserId,
        ctx.session,
        'channel@1.0.0',
        autumndbTestUtils.generateRandomSlug(),
        {
            filter: {
                name: 'Support channel',
                schema: {
                    type: 'object',
                    additionalProperties: true,
                    required: ['type', 'data'],
                    properties: {
                        type: {
                            type: 'string',
                            const: 'support-thread@1.0.0',
                        },
                        data: {
                            type: 'object',
                            additionalProperties: true,
                            required: ['inbox'],
                            properties: {
                                inbox: {
                                    type: 'string',
                                    const: 'Foobar',
                                },
                            },
                        },
                    },
                },
            },
        },
    );

    // Assign user as agent to channel
    agent = await ctx.createUser(autumndbTestUtils.generateRandomId().split('-')[0]);
    await ctx.createLinkThroughWorker(ctx.adminUserId, ctx.session, channel, agent, 'has agent', 'is agent for');

    // Create customer user
    customer = await ctx.createUser(autumndbTestUtils.generateRandomId().split('-')[0]);
    customerSession = await ctx.createSession(customer);
    await ctx.flushAll(ctx.session);

    // Wait for the polling mechanism to update the worker
    await delay(15 * 1000);
    await ctx.retry(
        () => {
            return _.find(ctx.worker.getTriggers(), {
                slug: `triggered-action-${channel.slug}-matchmake`,
            });
        }, (triggeredActionContract: any) => {
            console.log('triggeredActionContract:', JSON.stringify(triggeredActionContract, null, 4));
            return triggeredActionContract !== undefined;
        });

});

afterAll(async () => {
	await testUtils.destroyContext(ctx);
});

describe('action-matchmake', () => {
	test('should send notification on matching agent', async () => {
        const supportThread = await ctx.createSupportThread(customer.id, customerSession.id, 'Buzbaz', {
            inbox: 'Foobar',
            status: 'open',
        });
        await ctx.flushAll(customerSession.id);

        // Assert the expected whisper was created
        await ctx.waitForMatch({
            type: 'object',
            required: ['type', 'data'],
            properties: {
                type: {
                    const: 'whisper@1.0.0',
                },
                data: {
                    type: 'object',
                    required: ['target', 'payload'],
                    properties: {
                        target: {
                            const: supportThread.id,
                        },
                        payload: {
                            type: 'object',
                            required: ['message'],
                            properties: {
                                message: {
                                    const: `@${agent.slug.replace('user-', '')} - You have been chosen, take ownership if possible!`,
                                },
                            },
                        },
                    },
                },
            },
        });

        // Assert the expected notification was created
        const notifications = await ctx.kernel.query(ctx.logContext, ctx.session, {
            type: 'object',
            required: ['type'],
            properties: {
                type: {
                    const: 'notification@1.0.0',
                },
            },
        });
        console.log('notifications:', JSON.stringify(notifications, null, 4));
	});
});
