import { core } from '@balena/jellyfish-types';
import { WorkerContext } from '.';

export interface Action {
	handler: <TData = core.ContractData>(
		session: string,
		context: WorkerContext,
		contract: core.Contract<core.ContractData>,
		request: {
			action: core.ActionContract;
			card: string;
			actor: string;
			context: core.Context;
			timestamp: any;
			epoch: any;
			arguments: {
				[k: string]: any;
			};
			originator?: string;
		},
	) => Promise<
		null | core.ContractSummary<TData> | Array<core.ContractSummary<TData>>
	>;
	pre: (
		session: string,
		context: WorkerContext,
		request: {
			action: string;
			card: string;
			type: string;
			context: core.Context;
			arguments: {
				[k: string]: any;
			};
		},
	) => Promise<any> | any;
}

// tslint:disable: jsdoc-format
export interface EnqueueOptions {
	logContext?: LogContext;
	/** slug or id of input contract **/
	card: string;
	/** type of input contract **/
	type?: string;
	/** slug of action contract to run **/
	action: string;
	/** id of actor that the action should be run on behalf of **/
	actor: string;
	/** arguments to be passed to the action **/
	arguments: {
		[k: string]: unknown;
	};
}

export interface LogContext {
	id: string;
	api?: string;
}

export interface ActionLibrary {
	[key: string]: Action;
}
