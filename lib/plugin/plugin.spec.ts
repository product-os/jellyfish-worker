import _ from 'lodash';
import {
	action1,
	action2,
	card1,
	card2,
	integration1,
	integration2,
	TestPlugin,
} from './helpers';

describe('Plugin', () => {
	describe('validates the plugin', () => {
		test('by throwing an exception if the plugin does not implement the required interface', () => {
			const slug = 'Invalid slug';
			const getPlugin = () =>
				new TestPlugin({
					slug: 'Invalid slug',
				});
			expect(getPlugin).toThrow(`Invalid slug: ${slug}`);
		});

		test('by not throwing an exception if the plugin specifies a beta version', () => {
			const getPlugin = () =>
				new TestPlugin({
					version: '1.0.0-some-beta-version',
				});
			expect(getPlugin).not.toThrow();
		});
	});

	describe('.getCards', () => {
		test('returns an empty object if no cards are supplied to the plugin', () => {
			const plugin = new TestPlugin({});
			const cards = plugin.getCards();
			expect(cards).toEqual({});
		});

		test('throws an exception if duplicate card slugs are found', () => {
			const plugin = new TestPlugin({
				contracts: [card1, Object.assign({}, card2, { slug: card1.slug })],
			});

			const getCards = () => plugin.getCards();

			expect(getCards).toThrow('Duplicate contract: card-1');
		});

		test('returns a dictionary of cards, keyed by slug', () => {
			const plugin = new TestPlugin({
				contracts: [
					// Cards can be passed in as objects:
					card1,
					// ...or as a function that returns a card
					() => card2,
				],
			});

			const cards = plugin.getCards();

			expect(cards).toEqual({
				'card-1': card1,
				'card-2': card2,
			});
		});
	});

	describe('.getSyncIntegrations', () => {
		test('returns an empty object if no integrations are supplied to the plugin', () => {
			const plugin = new TestPlugin({});
			const loadedIntegrations = plugin.getSyncIntegrations();
			expect(loadedIntegrations).toEqual({});
		});

		test('returns a dictionary of integrations keyed by slug', () => {
			const plugin = new TestPlugin({
				integrationMap: {
					integration1,
					integration2,
				},
			});

			const loadedIntegrations = plugin.getSyncIntegrations();

			expect(loadedIntegrations).toEqual({
				integration1,
				integration2,
			});
		});
	});

	describe('.getActions', () => {
		test('returns an empty object if no actions are supplied to the plugin', () => {
			const plugin = new TestPlugin({});
			const loadedActions = plugin.getActions();
			expect(loadedActions).toEqual({});
		});

		test('returns a dictionary of actions keyed by slug', () => {
			const plugin = new TestPlugin({
				actions: [action1, action2],
			});

			const loadedActions = plugin.getActions();

			expect(loadedActions).toEqual({
				'action-1': _.omit(action1, ['contract']),
				'action-2': _.omit(action2, ['contract']),
			});
		});
	});
});