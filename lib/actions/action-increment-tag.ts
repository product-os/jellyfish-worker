import type { ContractSummary } from 'autumndb';
import { castArray, isArray, isNull, trim } from 'lodash';
import type { ActionDefinition } from '../plugin';
import { actionCreateCard } from './action-create-card';
import { actionIncrement } from './action-increment';

const actionIncrementHandler = actionIncrement.handler;
const actionCreateCardHandler = actionCreateCard.handler;

/**
 * @summary Merge increment results to ensure result set type validity
 * @function
 *
 * @param set - array of contract summaries to append to
 * @param item - increment to process
 */
export function mergeIncrements(
	set: ContractSummary[],
	item: ContractSummary | ContractSummary[] | null,
): void {
	if (!isNull(item)) {
		if (isArray(item)) {
			item.forEach((subItem: ContractSummary) => {
				set.push(subItem);
			});
		} else {
			set.push(item);
		}
	}
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const names = castArray(request.arguments.name);
	const increments: ContractSummary[] = [];
	for (const item of names) {
		// names.forEach(async (item: string) => {
		// Remove leading and trailing whitespace and # symbol
		const name = trim(item.toLowerCase().trim(), '#');
		const slug = `tag-${name}`;

		const tagCard = await context.getCardBySlug(session, `${slug}@1.0.0`);

		const incrementOptions = {
			actor: request.actor,
			originator: request.originator,
			arguments: {
				path: ['data', 'count'],
			},
		};

		if (tagCard) {
			mergeIncrements(
				increments,
				await actionIncrementHandler(session, context, tagCard, {
					...request,
					...incrementOptions,
				}),
			);
			continue;
		}

		const createOptions = {
			actor: request.actor,
			originator: request.originator,
			arguments: {
				properties: {
					slug,
					name,
					data: {
						count: 1,
					},
				},
			},
		};

		try {
			const result = await actionCreateCardHandler(session, context, card, {
				...request,
				...createOptions,
			});
			mergeIncrements(increments, result);
			continue;
		} catch (error: any) {
			// Notice action-create-card throws an error if the card
			// you want to create already exists. Because we check if
			// the tag exists to decide whether to update or insert in
			// a non atomic way, two calls can concurrently think the
			// tag doesn't exist, and therefore one will fail.
			//
			// In order to ensure the tag number remains correct, we
			// can check if our insert failed, and if so retry using
			// an update instead.
			if (error.name === 'JellyfishElementAlreadyExists') {
				// Get the card again
				const input = (await context.getCardBySlug(session, `${slug}@1.0.0`))!;

				mergeIncrements(
					increments,
					await actionIncrementHandler(session, context, input, {
						...request,
						...incrementOptions,
					}),
				);

				continue;
			}

			throw error;
		}
	}

	return increments;
};

export const actionIncrementTag: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-increment-tag',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: "Increment a the count value on a tag, or create one if it doesn't exist",
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				name: {
					type: ['string', 'array'],
				},
			},
		},
	},
};
