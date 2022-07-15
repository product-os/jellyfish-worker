import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import { Logger, LogLevel, LogMeta } from '@graphile/logger';
import type { Kernel, LinkContract } from 'autumndb';
import * as graphileWorker from 'graphile-worker';
import _ from 'lodash';
import type { Pool } from 'pg';
import { post } from './events';
import type { ActionRequestContract, ExecuteContract } from '../types';

const logger = getLogger(__filename);

const LINK_EXECUTE = {
	NAME: 'executes',
	INVERSE_NAME: 'is executed by',
};

const EXECUTE_LINK_VERSION = '1.0.0';

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
		actor: string,
		logContext: LogContext,
		actionRequest: ActionRequestContract,
		results: PostResults,
	) => Promise<ExecuteContract>;
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

export interface PostOptions {
	id: string;
	actor: string;
	action: string;
	timestamp: string;
	card: string;
	originator?: string;
}

const getExecuteLinkSlug = (actionRequest: ActionRequestContract): string => {
	return `link-execute-${actionRequest.slug}`;
};

const linkExecuteEvent = async (
	kernel: Kernel,
	logContext: LogContext,
	session: string,
	eventContract: ExecuteContract,
	actionRequest: ActionRequestContract,
): Promise<LinkContract> => {
	return kernel.insertContract<LinkContract>(logContext, session, {
		slug: getExecuteLinkSlug(actionRequest),
		type: 'link@1.0.0',
		version: EXECUTE_LINK_VERSION,
		name: LINK_EXECUTE.NAME,
		data: {
			inverseName: LINK_EXECUTE.INVERSE_NAME,
			from: {
				id: eventContract.id,
				type: eventContract.type,
			},
			to: {
				id: actionRequest.id,
				type: actionRequest.type,
			},
		},
	});
};

export class Consumer implements QueueConsumer {
	messagesBeingHandled: number = 0;
	graphileRunner: graphileWorker.Runner | null = null;

	constructor(
		private kernel: Kernel,
		private pool: Pool,
		private session: string,
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
				logger: new Logger(graphileLoggerToJellyfishLogger(logContext)),
				taskList: {
					actionRequest: async (graphilePayload, helpers) => {
						// TS-TODO: Update graphile types to support Task list type parmaeterisation so we don't need to cast
						const payload = graphilePayload as ActionRequestContract;
						helpers.logger.debug('Consuming job', {
							priority: helpers.job.priority,
							id: helpers.job.id,
							created_at: helpers.job.created_at?.valueOf(),
							slug: payload?.slug,
							action: payload?.data?.action,
						});
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
	 * @param _actor - actor. TS-TODO - this parameter is currently unused.
	 * @param logContext - log context
	 * @param actionRequest - action request contract
	 * @param results - action results
	 * @returns execute event contract
	 */
	async postResults(
		_actor: string,
		logContext: LogContext,
		actionRequest: ActionRequestContract,
		results: PostResults,
	): Promise<ExecuteContract> {
		const eventContract = await post(
			logContext,
			this.kernel,
			this.session,
			{
				action: actionRequest.data.action,
				actor: actionRequest.data.actor,
				id: actionRequest.id,
				card: actionRequest.data.input.id,
				timestamp: actionRequest.data.timestamp,
				originator: actionRequest.data.originator,
			},
			results,
		);

		await linkExecuteEvent(
			this.kernel,
			logContext,
			this.session,
			eventContract,
			actionRequest,
		);

		return eventContract;
	}
}
function graphileLoggerToJellyfishLogger(logContext: LogContext) {
	return (_scope) => {
		return (level: LogLevel, message: string, meta?: LogMeta) => {
			switch (level) {
				case LogLevel.ERROR:
					logger.error(logContext, message, meta);
					break;
				case LogLevel.WARNING:
					logger.warn(logContext, message, meta);
					break;
				case LogLevel.INFO:
					logger.info(logContext, message, meta);
					break;
				case LogLevel.DEBUG:
					logger.debug(logContext, message, meta);
					break;
				default: // There are no other levels but just in case they're added
					logger.debug(logContext, message, meta);
					break;
			}
		};
	};
}
