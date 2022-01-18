import * as _ from 'lodash';
import * as sinon from 'sinon';
import {
	action1,
	action2,
	card1,
	card2,
	integration1,
	integration2,
	TestPlugin,
} from './plugin-fixtures';

describe('JellyfishPlugin', () => {
	describe('validates the plugin', () => {
		test('by throwing an exception if the plugin does not implement the required interface', () => {
			const getPlugin = () =>
				new TestPlugin({
					slug: 'Invalid slug',
				});
			expect(getPlugin).toThrow(/data\.slug should match pattern/);
		});

		test('but will not throw an exception if the plugin specifies a beta version', () => {
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

			expect(getCards).toThrow("Duplicate cards with slug 'card-1' found");
		});

		test('throws an exception if duplicate action slugs are found', () => {
			const plugin = new TestPlugin({
				contracts: [card1],
				actions: [
					action1,
					Object.assign({}, action2, {
						contract: {
							slug: action1.contract.slug,
						},
					}),
				],
			});

			const getCards = () => plugin.getCards();

			expect(getCards).toThrow("Duplicate cards with slug 'action-1' found");
		});

		test('passes mixins to any card provided as a function', () => {
			const cardFunction = sinon.stub().returns(card1);
			const testMixin = _.identity;

			const plugin = new TestPlugin({
				contracts: [cardFunction],
				mixins: {
					test: testMixin,
				},
			});

			const cards = plugin.getCards();

			expect(cardFunction.calledOnce).toBe(true);
			expect(cardFunction.firstCall.firstArg.test).toBe(testMixin);
			expect(cards).toEqual({
				'card-1': card1,
			});
		});

		test('returns a dictionary of cards, keyed by slug', () => {
			const plugin = new TestPlugin({
				contracts: [
					// Cards can be passed in as objects:
					card1,
					// ...or as a function that returns a card
					({ mixin }) => mixin()(card2),
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
					[integration1.slug]: integration1,
					[integration2.slug]: integration2,
				},
			});

			const loadedIntegrations = plugin.getSyncIntegrations();

			expect(loadedIntegrations).toEqual({
				'integration-1': integration1,
				'integration-2': integration2,
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
				'action-1': {
					handler: action1.handler,
					pre: action1.pre || _.noop,
				},
				'action-2': {
					handler: action2.handler,
					pre: action2.pre || _.noop,
				},
			});
		});
	});
});
