import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { contractMixins } from 'autumndb';

const eventsPartial = `FILTER(contract.links['has attached element'], function (c) { return c && c.type && c.type !== 'create@1.0.0' && c.type !== 'update@1.0.0' })`;

// This mixin defines all common fields in cards that support
// attached events (i.e. 'timelines')
export function withEvents(slug: string, type: string): ContractDefinition {
	return {
		slug,
		type,
		data: {
			schema: {
				properties: {
					tags: {
						type: 'array',
						items: {
							type: 'string',
						},
						$$formula: `AGGREGATE(${eventsPartial}, 'tags', input)`,
						fullTextSearch: true,
					},
					data: {
						properties: {
							participants: {
								type: 'array',
								$$formula: `AGGREGATE(${eventsPartial}, 'data.actor')`,
							},
							mentionsUser: {
								type: 'array',
								$$formula: `AGGREGATE(${eventsPartial}, 'data.payload.mentionsUser')`,
							},
							alertsUser: {
								type: 'array',
								$$formula: `AGGREGATE(${eventsPartial}, 'data.payload.alertsUser')`,
							},
							mentionsGroup: {
								type: 'array',
								$$formula: `AGGREGATE(${eventsPartial}, 'data.payload.mentionsGroup')`,
							},
							alertsGroup: {
								type: 'array',
								$$formula: `AGGREGATE(${eventsPartial}, 'data.payload.alertsGroup')`,
							},
						},
					},
				},
			},
			uiSchema: {
				fields: {
					tags: contractMixins.uiSchemaDef('badgeList'),
					data: {
						'ui:order': [
							'mentionsUser',
							'alertsUser',
							'mentionsGroup',
							'alertsGroup',
							'participants',
						],
						mentionsUser: contractMixins.uiSchemaDef('usernameList'),
						alertsUser: contractMixins.uiSchemaDef('usernameList'),
						mentionsGroup: contractMixins.uiSchemaDef('groupList'),
						alertsGroup: contractMixins.uiSchemaDef('groupList'),
						participants: contractMixins.uiSchemaDef('userIdList'),
					},
				},
			},
		},
	};
}
