import { getLogger, LogContext } from '@balena/jellyfish-logger';
import { strict as assert } from 'assert';
import type { AutumnDBSession, ContractData, Kernel } from 'autumndb';
import * as graphileWorker from 'graphile-worker';
import type { Pool } from 'pg';
import { QueueNoRequest } from './errors';
import { wait } from './events';
import type { ActionRequestContract } from '../types';

const logger = getLogger(__filename);

const GRAPHILE_RETRIES = 10;
const GRAPHILE_RETRY_DELAY = 1000;

export interface ProducerOptions {
	logContext: LogContext;
	action: string;
	card: string;
	type: string;
	arguments: ContractData;
	currentDate?: Date;
	originator?: string;
}

export interface ProducerResults {
	error: boolean;
	timestamp: string;
	data:
		| {
				[k: string]: unknown;
		  }
		| string
		| number
		| boolean
		| unknown[]
		| null;
}

export interface QueueProducer {
	initialize: (logContext: LogContext) => Promise<void>;
	waitResults: (
		logContext: LogContext,
		actionRequest: ActionRequestContract,
	) => Promise<ProducerResults>;
	deleteJob: (context: LogContext, key: string) => Promise<void>;
}

/**
 * @summary Enqueue an action request
 * @function
 *
 * @param logContext - log context
 * @param pool - database connection pool
 * @param actor - actor id
 * @param actionRequest - action request contract
 * @returns enqueued action request contract
 */
export async function enqueue(
	logContext: LogContext,
	pool: Pool,
	actor: string,
	actionRequest: ActionRequestContract,
): Promise<ActionRequestContract> {
	const jobName = 'enqueue-action-request';
	const jobParameters: string[] = [`'actionRequest'`, '$1'];
	const values: any[] = [actionRequest];

	logger.info(logContext, 'Enqueueing action request', {
		actor,
		request: {
			slug: actionRequest.slug,
			action: actionRequest.data.action,
			card: actionRequest.data.card,
		},
	});

	await pool.query({
		name: jobName,
		text: `SELECT graphile_worker.add_job(${jobParameters.join(',')});`,
		values,
	});

	return actionRequest;
}

/**
 * Queue module for Jellyfish.
 *
 * @module queue
 */

export class Producer implements QueueProducer {
	constructor(
		private kernel: Kernel,
		private pool: Pool,
		private session: AutumnDBSession,
	) {}

	/**
	 * @summary Initialize the queue producer
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 */
	async initialize(logContext: LogContext): Promise<void> {
		// Set up the graphile worker to ensure that the graphile_worker schema
		// exists in the DB before we attempt to enqueue a job.
		const workerUtils = await this.makeWorkerUtils(logContext);
		await workerUtils.release();
	}

	/**
	 * @summary Make and return Graphile worker utils instance
	 * @function
	 *
	 * @param logContext - log context
	 * @param retries - number of times to retry Graphile worker initialization
	 * @returns graphile worker utils instance
	 *
	 * @example
	 * ```typescript
	 * const workerUtils = await this.makeWorkerUtils(context);
	 * ```
	 */
	async makeWorkerUtils(
		logContext: LogContext,
		retries: number = GRAPHILE_RETRIES,
	): Promise<graphileWorker.WorkerUtils> {
		try {
			const workerUtils = await graphileWorker.makeWorkerUtils({
				pgPool: this.pool,
			});
			return workerUtils;
		} catch (error) {
			if (retries > 0) {
				logger.info(logContext, 'Graphile worker failed to run', {
					retries,
					error,
				});
				await new Promise((resolve) => {
					setTimeout(resolve, GRAPHILE_RETRY_DELAY);
				});
				return this.makeWorkerUtils(logContext, retries - 1);
			}
			throw error;
		}
	}

	/**
	 * @summary Wait for an action request results
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param actionRequest - action request contract
	 * @returns producer results
	 */
	async waitResults(
		logContext: LogContext,
		actionRequest: ActionRequestContract,
	): Promise<ProducerResults> {
		logger.info(logContext, 'Waiting request results', {
			request: {
				id: actionRequest.id,
				slug: actionRequest.slug,
				card: actionRequest.data.input.id,
				type: actionRequest.data.input.type,
				actor: actionRequest.data.actor,
				action: actionRequest.data.action,
			},
		});

		const request = await wait(
			logContext,
			this.kernel,
			this.session,
			actionRequest.id,
		);

		logger.info(logContext, 'Got action-request results', {
			request: {
				id: actionRequest.id,
				slug: actionRequest.slug,
				card: actionRequest.data.input.id,
				type: actionRequest.data.input.type,
				actor: actionRequest.data.actor,
				action: actionRequest.data.action,
			},
		});

		assert(
			request && request.data.results,
			new QueueNoRequest(
				`Executed action-request not found: ${JSON.stringify(
					actionRequest,
					null,
					2,
				)}`,
			),
		);

		return {
			error: request.data.results.error,
			timestamp: request.data.timestamp,
			data: request.data.results.data,
		};
	}

	/**
	 * @summary Delete a job from the queue using its job key
	 * @function
	 *
	 * @param logContext - execution context
	 * @param key - job key to delete
	 */
	async deleteJob(logContext: LogContext, key: string): Promise<void> {
		logger.debug(logContext, 'Deleting job from queue', {
			key,
		});

		await this.pool.query({
			text: `SELECT graphile_worker.remove_job($1);`,
			values: [key],
		});
	}
}
