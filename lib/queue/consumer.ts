import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import { Logger } from '@graphile/logger';
import type { AutumnDBSession, Kernel } from 'autumndb';
import * as graphileWorker from 'graphile-worker';
import _ from 'lodash';
import type { Pool } from 'pg';
import { post } from './events';
import type { ActionRequestContract } from '../types';

const logger = getLogger(__filename);

const RUN_RETRIES = 10;
const RUN_RETRY_DELAY = 1000;

export declare type OnMessageEventHandler = (
	payload: ActionRequestContract,
) => Promise<void>;

export interface QueueConsumer {
	initializeWithEventHandler: (
		logContext: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
	) => Promise<void>;
	run: (
		logContext: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
		retries?: number,
	) => Promise<boolean>;
	cancel: () => Promise<void>;
	postResults: (
		logContext: LogContext,
		actionRequest: ActionRequestContract,
		results: PostResults,
	) => Promise<ActionRequestContract>;
}

export interface PostResults {
	data:
		| string
		| {
				originator?: string;
				[key: string]: any;
		  };
	error: boolean;
}

export class Consumer implements QueueConsumer {
	messagesBeingHandled: number = 0;
	graphileRunner: graphileWorker.Runner | null = null;

	constructor(
		private kernel: Kernel,
		private pool: Pool,
		private session: AutumnDBSession,
	) {}

	async initializeWithEventHandler(
		logContext: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
	): Promise<void> {
		await this.run(logContext, onMessageEventHandler);
		this.graphileRunner!.stop = _.once(this.graphileRunner!.stop);
	}

	async run(
		logContext: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
		retries: number = RUN_RETRIES,
	): Promise<boolean> {
		try {
			this.graphileRunner = await graphileWorker.run({
				noHandleSignals: true,
				pgPool: this.pool,
				concurrency: defaultEnvironment.queue.concurrency,
				pollInterval: 1000,
				logger: new Logger((_scope) => {
					return _.noop;
				}),
				taskList: {
					actionRequest: async (result) => {
						// TS-TODO: Update graphile types to support Task list type parmaeterisation so we don't need to cast
						const payload = result as ActionRequestContract;
						const action = payload.data.action.split('@')[0];
						try {
							this.messagesBeingHandled++;
							metrics.markJobAdd(action, logContext.id);
							await onMessageEventHandler(payload);
						} finally {
							this.messagesBeingHandled--;
							metrics.markJobDone(
								action,
								logContext.id,
								payload.data.timestamp,
							);
						}
					},
				},
			});
		} catch (error) {
			if (retries > 0) {
				logger.info(logContext, 'Graphile worker failed to run', {
					retries,
					error,
				});
				await new Promise((resolve) => {
					setTimeout(resolve, RUN_RETRY_DELAY);
				});
				return this.run(logContext, onMessageEventHandler, retries - 1);
			}
			throw error;
		}

		return true;
	}

	async cancel(): Promise<void> {
		if (this.graphileRunner) {
			await this.graphileRunner.stop();
		}
		while (this.messagesBeingHandled > 0) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}
	}

	/**
	 * @summary Post execution results
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param actionRequest - action request contract
	 * @returns execute event contract
	 */
	async postResults(
		logContext: LogContext,
		actionRequest: ActionRequestContract,
		results: PostResults,
	): Promise<ActionRequestContract> {
		return post(
			logContext,
			this.kernel,
			this.session,
			`${actionRequest.slug}@${actionRequest.version}`,
			results,
		);
	}
}
