type Test = { name: string; run: () => void | Promise<void> };

const tests: Test[] = [];

export function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

export function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

export async function runTests(): Promise<void> {
  let failed = 0;
  for (const current of tests) {
    try {
      await current.run();
      console.log(`✓ ${current.name}`);
    } catch (error) {
      failed++;
      console.error(`✗ ${current.name}`);
      console.error(error);
    }
  }
  if (failed) process.exitCode = 1;
  else console.log(`\n${tests.length} tests passed.`);
}
