import { ContractData, ContractDefinition, contractMixins } from 'autumndb';
import _ from 'lodash';

export { asPipelineItem } from './as-pipeline-item';
export { asTimeZone } from './as-time-zone';
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
