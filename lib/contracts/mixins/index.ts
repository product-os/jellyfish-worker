import type {
	ContractData,
	ContractDefinition,
} from '@balena/jellyfish-types/build/core';
import { contractMixins } from 'autumndb';
import _ from 'lodash';

export { asPipelineItem } from './as-pipeline-item';
export { withEvents } from './with-events';

export const mixin = (...mixins: ContractDefinition[]) => {
	return <TData = ContractData>(
		base: ContractDefinition<TData>,
	): ContractDefinition<TData> => {
		return _.mergeWith(
			{},
			base,
			...mixins,
			contractMixins.mergeWithUniqConcatArrays,
		);
	};
};
