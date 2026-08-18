import * as readline from 'readline';

/**
 * Simple prompt utility for interactive CLI questions.
 *
 * @remarks
 * Uses readline to get user input without external dependencies.
 */
export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const promptText = defaultValue
      ? `${question} (${defaultValue}): `
      : `${question}: `;

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export async function confirm(question: string, defaultValue: boolean = true): Promise<boolean> {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await prompt(`${question} (${defaultText})`);

  if (!answer) return defaultValue;

  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export async function multiSelect(
  question: string,
  options: string[],
  defaults?: string[]
): Promise<string[]> {
  console.log(`\n${question}`);
  console.log('Enter numbers separated by commas (e.g., 1,2,3):');

  options.forEach((option, index) => {
    const selected = defaults?.includes(option) ? '[x]' : '[ ]';
    console.log(`  ${selected} ${index + 1}. ${option}`);
  });

  const answer = await prompt('Selection', defaults ? defaults.map((_, i) => String(i + 1)).join(',') : '');

  if (!answer) {
    return defaults || [];
  }

  const indices = answer.split(',').map(s => parseInt(s.trim()) - 1);
  return indices
    .filter(i => i >= 0 && i < options.length)
    .map(i => options[i]);
}
