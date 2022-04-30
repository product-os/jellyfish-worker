import { getNextExecutionDate } from './producer';

describe('.getNextExecutionDate()', () => {
	test('should return expected date for one-time schedule', () => {
		const schedule = {
			once: {
				date: new Date(Date.now() + 60000),
			},
		};
		expect(getNextExecutionDate(schedule)).toEqual(schedule.once.date);
	});

	test('should return expected date for recurring schedule', () => {
		const now = new Date();
		const start = new Date(new Date().setMinutes(now.getMinutes() - 10));
		const end = new Date(new Date().setMinutes(now.getMinutes() + 30));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toEqual(
			new Date(new Date().setMinutes(now.getMinutes() + 1, 0, 0)),
		);
	});

	test('should return null for past one-time schedule', () => {
		const schedule = {
			once: {
				date: new Date(Date.now() - 60000),
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should return null for recurring schedule with past end date', () => {
		const now = new Date();
		const start = new Date(new Date().setMinutes(now.getMinutes() - 30));
		const end = new Date(new Date().setMinutes(now.getMinutes() - 10));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should return expected date for recurring schedule with future start date', () => {
		const now = new Date();
		const start = new Date(new Date().setFullYear(now.getFullYear() + 1));
		const end = new Date(new Date().setFullYear(now.getFullYear() + 2));

		const schedule = {
			recurring: {
				start,
				end,
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toEqual(
			new Date(new Date(start.getTime() + 60000).setSeconds(0, 0)),
		);
	});

	test('should return null for recurring schedule whose start date is after its end date', () => {
		const schedule = {
			recurring: {
				start: new Date(Date.now() - 60000),
				end: new Date(Date.now() - 120000),
				interval: '* * * * *',
			},
		};

		expect(getNextExecutionDate(schedule)).toBeNull();
	});

	test('should throw error on invalid schedule configuration', () => {
		expect(() => {
			getNextExecutionDate({
				recurring: {
					start: new Date(Date.now() - 120000),
					end: new Date(Date.now() + 120000),
					interval: 'a b c d e',
				},
			});
		}).toThrowError();
	});
});
