import * as events from './events';

describe('getExecuteEventSlug', () => {
	test('generates a valid slug', () => {
		const eventSlug = events.getExecuteEventSlug({
			id: 'test',
		});
		expect(eventSlug).toBe('execute-test');
	});
});
