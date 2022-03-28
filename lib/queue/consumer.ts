import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import type { LinkContract } from '@balena/jellyfish-types/build/core';
import { Logger } from '@graphile/logger';
import { Kernel } from 'autumndb';
import * as graphileWorker from 'graphile-worker';
import _ from 'lodash';
import type { Pool } from 'pg';
import { contracts } from './contracts';
import { post } from './events';
import type { ActionRequestContract, ExecuteContract } from './types';

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
		logger.info(logContext, 'Inserting essential contracts');
		await Promise.all(
			Object.values(contracts).map(async (contract) => {
				return this.kernel.replaceContract(logContext, this.session, contract);
			}),
		);

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
