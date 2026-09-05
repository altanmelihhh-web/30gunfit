import { parseHevyWorkout, workoutStats } from './hevyParser';

test('parses Turkish Hevy full body export with date, cardio notes and warmup sets', () => {
  const parsed = parseHevyWorkout(`
Tüm Vücut 1
Cuma, Ağu 07, 2026, 7:39am

Koşu Bandı

Rear Delt Reverse Fly (Makine)
Set 1: 9 kg x 12
Set 2: 9 kg x 12
Set 3: 14 kg x 12

Chest Fly (Makine)
Set 1: 9 kg x 15 [Isınma]
Set 2: 14 kg x 12
Set 3: 14 kg x 12
Set 4: 18 kg x 12

Yürüme
`);

  expect(parsed.title).toBe('Tüm Vücut 1');
  expect(parsed.date).toBe('2026-08-07');
  expect(parsed.time).toBe('7:39am');
  expect(parsed.exercises.map((exercise) => exercise.name)).toEqual([
    'Koşu Bandı',
    'Rear Delt Reverse Fly (Makine)',
    'Chest Fly (Makine)',
    'Yürüme'
  ]);
  expect(parsed.exercises[0].sets).toEqual([]);
  expect(parsed.exercises[2].sets[0]).toEqual({ weight_kg: 9, reps: 15, isWarmup: true });
  expect(workoutStats(parsed)).toMatchObject({ exerciseCount: 4, totalSets: 7 });
});

test('keeps first exercise when pasted set list has no workout title', () => {
  const parsed = parseHevyWorkout(`
Rear Delt Reverse Fly (Makine)
Set 1: 9 kg x 12
Set 2: 9 kg x 12
Set 3: 14 kg x 12

Chest Fly (Makine)
Set 1: 9 kg x 15 [Isınma]
Set 2: 14 kg x 12
`);

  expect(parsed.title).toBe('');
  expect(parsed.exercises.map((exercise) => exercise.name)).toEqual([
    'Rear Delt Reverse Fly (Makine)',
    'Chest Fly (Makine)'
  ]);
  expect(parsed.exercises[0].sets).toHaveLength(3);
  expect(parsed.exercises[1].sets[0]).toEqual({ weight_kg: 9, reps: 15, isWarmup: true });
});

test('parses duration on no-set activity lines', () => {
  const parsed = parseHevyWorkout(`
Tüm Vücut 1

Yürüme 35 dk
`);

  expect(parsed.exercises[0]).toMatchObject({
    name: 'Yürüme',
    duration_min: 35,
    distance_km: null,
    sets: []
  });
});
