import { promptUser } from './prompts.js';
import { generateProject } from './generator.js';

export async function runCLI() {
  console.log('Welcome to React Forge! 🛠️');
  const answers = await promptUser();
  await generateProject(answers);
}
