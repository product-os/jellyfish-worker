import type {
	Contract,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';

export interface ActionData {
	filter?: {
		[k: string]: unknown;
	};
	extends?: string;
	arguments: {
		/**
		 * This interface was referenced by `undefined`'s JSON-Schema definition
		 * via the `patternProperty` "^[a-z0-9]+$".
		 */
		[k: string]: {
			[k: string]: unknown;
		};
	};
	[k: string]: unknown;
}

export interface ActionContractDefinition
	extends ContractDefinition<ActionData> {}

export interface ActionContract extends Contract<ActionData> {}

export interface ActionRequestData {
	actor: string;
	epoch: number;
	input: {
		id: string;
		[k: string]: unknown;
	};
	action: string;
	context: {
		[k: string]: unknown;
		id: string;
	};
	arguments: {
		[k: string]: unknown;
	};
	timestamp: string;
	originator?: string;
	schedule?: string;
	[k: string]: unknown;
}

export interface ActionRequestContractDefinition
	extends ContractDefinition<ActionRequestData> {}

export interface ActionRequestContract extends Contract<ActionRequestData> {}

export interface ExecuteData {
	actor: string;
	target: string;
	payload: {
		card: string;
		data:
			| {
					[k: string]: unknown;
			  }
			| string
			| number
			| boolean
			| unknown[]
			| null;
		error: boolean;
		action: string;
		timestamp: string;
		[k: string]: unknown;
	};
	timestamp: string;
	originator?: string;
	[k: string]: unknown;
}

export interface ExecuteContractDefinition
	extends ContractDefinition<ExecuteData> {}

export interface ExecuteContract extends Contract<ExecuteData> {}
