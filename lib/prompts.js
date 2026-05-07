import inquirer from 'inquirer';

export async function promptUser() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project named?',
      default: 'react-forge-app',
      validate: (input) => {
        if (/^([a-z0-9_-]+)$/.test(input)) return true;
        return 'Project name may only include lowercase letters, numbers, underscores and hashes.';
      },
    },
    {
      type: 'list',
      name: 'buildTool',
      message: 'Which build tool would you like to use?',
      choices: ['Vite', 'Webpack'],
      default: 'Vite',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Which language will you use?',
      choices: ['JavaScript', 'TypeScript'],
      default: 'JavaScript',
    },
    {
      type: 'list',
      name: 'stateManagement',
      message: 'Which state management solution do you want?',
      choices: ['None', 'Redux', 'Zustand'],
      default: 'None',
    },
    {
      type: 'list',
      name: 'styling',
      message: 'Which styling solution do you want? (SCSS is included by default)',
      choices: ['None', 'Tailwind'],
      default: 'None',
    },
  ]);

  return answers;
}
