import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateProject(answers) {
  const { projectName, buildTool, language, stateManagement, styling } = answers;
  const targetDir = path.resolve(process.cwd(), projectName);

  const spinner = ora(`Forging your React project: ${projectName}...`).start();

  try {
    // 1. Determine base template
    const bt = buildTool.toLowerCase();
    const ext = language === 'TypeScript' ? 'ts' : 'js';
    const templateName = `${bt}-${ext}`;
    const templatePath = path.resolve(__dirname, '..', 'templates', templateName);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // 2. Copy base template
    spinner.text = 'Copying base template...';
    await fs.copy(templatePath, targetDir);

    // 3. Update package.json name
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;

    // 4. Inject State Management
    if (stateManagement !== 'None') {
      spinner.text = `Injecting ${stateManagement}...`;
      const stateExt = language === 'TypeScript' ? 'ts' : 'js';
      const stateTemplatePath = path.resolve(__dirname, '..', 'templates', 'state', `${stateManagement.toLowerCase()}-${stateExt}`);
      
      if (fs.existsSync(stateTemplatePath)) {
        await fs.copy(stateTemplatePath, path.join(targetDir, 'src', 'store'));
      }

      if (stateManagement === 'Redux') {
        pkg.dependencies = {
          ...pkg.dependencies,
          '@reduxjs/toolkit': '^2.0.0',
          'react-redux': '^9.0.0',
        };
        // Update main.jsx/tsx to wrap Provider
        const mainExt = language === 'TypeScript' ? 'tsx' : 'jsx';
        const mainFile = path.join(targetDir, 'src', `main.${mainExt}`);
        if (fs.existsSync(mainFile)) {
          let mainContent = await fs.readFile(mainFile, 'utf8');
          mainContent = mainContent.replace(
            /import App from '\.\/App(\.jsx)?';/,
            `import App from './App${mainExt === 'tsx' ? '' : '.jsx'}';\nimport { Provider } from 'react-redux';\nimport { store } from './store/store';`
          );
          mainContent = mainContent.replace('<App />', '<Provider store={store}>\n      <App />\n    </Provider>');
          await fs.writeFile(mainFile, mainContent);
        }
      } else if (stateManagement === 'Zustand') {
        pkg.dependencies = {
          ...pkg.dependencies,
          'zustand': '^4.5.0',
        };
      }
    }

    // 5. Inject Styling (SCSS is already in base templates)
    if (styling === 'Tailwind') {
      spinner.text = 'Injecting Tailwind CSS...';
      pkg.devDependencies = {
        ...pkg.devDependencies,
        'tailwindcss': '^3.4.0',
        'postcss': '^8.4.0',
        'autoprefixer': '^10.4.0',
      };
      
      // Copy tailwind configs
      const tailwindTemplatePath = path.resolve(__dirname, '..', 'templates', 'styling', 'tailwind');
      if (fs.existsSync(tailwindTemplatePath)) {
        await fs.copy(tailwindTemplatePath, targetDir);
      }
      
      // Update main index.scss to include tailwind directives
      const cssFile = path.join(targetDir, 'src', 'index.scss');
      if (fs.existsSync(cssFile)) {
        const cssContent = await fs.readFile(cssFile, 'utf8');
        const tailwindDirectives = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n`;
        await fs.writeFile(cssFile, tailwindDirectives + cssContent);
      }
    }

    // 6. Inject Tooling (ESLint + Prettier) by default
    spinner.text = 'Injecting ESLint & Prettier...';
    
    // Copy Prettier
    const prettierTemplatePath = path.resolve(__dirname, '..', 'templates', 'tooling', 'prettier');
    if (fs.existsSync(prettierTemplatePath)) {
      await fs.copy(prettierTemplatePath, targetDir);
    }

    // Copy ESLint (based on language)
    const eslintExt = language === 'TypeScript' ? 'eslint-ts' : 'eslint-js';
    const eslintTemplatePath = path.resolve(__dirname, '..', 'templates', 'tooling', eslintExt);
    if (fs.existsSync(eslintTemplatePath)) {
      await fs.copy(eslintTemplatePath, targetDir);
    }

    // Add Tooling devDependencies
    pkg.devDependencies = {
      ...pkg.devDependencies,
      'eslint': '^8.55.0',
      'eslint-config-prettier': '^9.1.0',
      'eslint-plugin-react': '^7.33.2',
      'eslint-plugin-react-hooks': '^4.6.0',
      'eslint-plugin-react-refresh': '^0.4.5',
      'prettier': '^3.1.1'
    };

    if (language === 'TypeScript') {
      pkg.devDependencies['@typescript-eslint/eslint-plugin'] = '^6.14.0';
      pkg.devDependencies['@typescript-eslint/parser'] = '^6.14.0';
    }

    // Add Tooling scripts
    pkg.scripts = {
      ...pkg.scripts,
      lint: `eslint . --ext ${language === 'TypeScript' ? 'ts,tsx' : 'js,jsx'} --report-unused-disable-directives --max-warnings 0`,
      format: 'prettier --write \"src/**/*.{js,jsx,ts,tsx,css,scss,md}\"'
    };

    // Write updated package.json
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });

    spinner.succeed(chalk.green(`Successfully forged ${projectName}!`));
    console.log('\nNext steps:');
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  npm install'));
    console.log(chalk.cyan('  npm start (or npm run dev)'));
    console.log('\nHappy Coding!');

  } catch (error) {
    spinner.fail(chalk.red('Failed to forge project.'));
    console.error(error);
  }
}
