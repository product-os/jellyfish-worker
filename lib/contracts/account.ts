import { ContractDefinition, contractMixins } from 'autumndb';

export const account: ContractDefinition = {
	slug: 'account',
	type: 'type@1.0.0',
	name: 'Account',
	markers: [],
	data: {
		schema: {
			type: 'object',
			properties: {
				markers: {
					type: 'array',
					items: {
						type: 'string',
						pattern: '^[a-zA-Z0-9-_/:+]+$',
					},
				},
				name: {
					type: ['string', 'null'],
					fullTextSearch: true,
				},
				data: {
					type: 'object',
					properties: {
						type: {
							default: 'Lead',
							enum: ['Lead', 'Customer'],
						},
						email: {
							title: 'Email address',
							type: 'array',
							uniqueItems: true,
							items: {
								type: 'string',
								format: 'email',
							},
							fullTextSearch: true,
						},
						discountPercentage: {
							title: 'Discount percentage',
							description:
								'The percentage of discount for the current subscription. 0.1 will stand for 10% discount, -0.1 will stand for 10% surcharge',
							type: 'number',
							readOnly: true,
						},
						billingCode: {
							title: 'Billing code',
							type: 'string',
							readOnly: true,
						},
						billingCycle: {
							title: 'Billing cycle',
							type: 'string',
							readOnly: true,
						},
						canSelfServe: {
							title: 'can self serve',
							type: 'boolean',
							readOnly: true,
						},
						isLegacy: {
							title: 'is Legacy',
							type: 'boolean',
							readOnly: true,
						},
						monthlyPrice: {
							title: 'Monthly price',
							description:
								'Monthly price without discounts or plan addons included',
							type: 'number',
							readOnly: true,
						},
						annualPrice: {
							title: 'Annual price',
							description:
								'Annual price without discounts or plan addons included',
							type: 'number',
							readOnly: true,
						},
						startsOnDate: {
							title: 'Starts on date',
							type: 'string',
							format: 'date-time',
							readOnly: true,
						},
						endsOnDate: {
							title: 'Ends on date',
							type: 'string',
							format: 'date-time',
							readOnly: true,
						},
						industry: {
							title: 'Industry',
							type: 'string',
							readOnly: true,
						},
						location: {
							title: 'Location',
							type: 'string',
						},
						stageOfBusiness: {
							title: 'Stage of business',
							type: 'string',
						},
						description: {
							title: 'Description',
							type: 'string',
							format: 'markdown',
						},
						SumMonthlyPrice: {
							title: 'Sum Monthly price',
							description:
								'Calculated with the formula: monthlyPrice * (1 - discountPercentage). This number is excluding plan addons',
							type: 'number',
							$$formula:
								'SUM(contract.data.monthlyPrice * (1 - contract.data.discountPercentage))',
							readOnly: true,
						},
						SumAnnualPrice: {
							title: 'Sum Annual price',
							description:
								'Calculated with the formula: annualPrice * (1 - discountPercentage). This number is excluding plan addons',
							type: 'number',
							$$formula:
								'SUM(contract.data.annualPrice * (1 - contract.data.discountPercentage))',
							readOnly: true,
						},
					},
				},
			},
			required: ['data'],
		},
		uiSchema: {
			fields: {
				data: {
					type: {
						'ui:widget': 'HighlightedName',
					},
					email: contractMixins.uiSchemaDef('email'),
					startsOnDate: contractMixins.uiSchemaDef('date'),
					endsOnDate: contractMixins.uiSchemaDef('date'),
				},
			},
		},
		slices: ['properties.data.properties.profile.properties.status'],
	},
};
