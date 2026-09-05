import { computeBMR, energyBalance, profileWithLatestWeight } from './calorieMath';

test('computes BMR with latest valid tracked weight', () => {
  const profile = { gender: 'male', age: 30, height: 180, weight: 80 };
  const updatedProfile = profileWithLatestWeight(profile, [
    { date: '2026-01-01', weight: 79 },
    { date: '2026-02-01', weight: 78.5 }
  ]);

  expect(updatedProfile.weight).toBe(78.5);
  expect(computeBMR(updatedProfile)).toBe(1765);
});

test('calculates full day energy deficit from BMR, active energy and consumed calories', () => {
  const balance = energyBalance({
    bmr: 1800,
    vitals: { active_calories: 650 },
    consumed: 2100
  });

  expect(balance).toMatchObject({
    restingEnergy: 1800,
    activeEnergy: 650,
    totalExpenditure: 2450,
    deficit: 350
  });
});
