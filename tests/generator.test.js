import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateProject } from '../lib/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.resolve(__dirname, 'temp-projects');

// Mock ora spinner to keep test output clean
vi.mock('ora', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const spinner = {
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: '',
      };
      return spinner;
    }),
  };
});

// Spy on console methods to avoid cluttering test output
beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await fs.ensureDir(tempDir);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.remove(tempDir);
});

describe('generateProject Integration Tests', () => {
  it('should generate a Vite + JavaScript + Redux + Tailwind project correctly', async () => {
    const projectName = 'vite-js-redux-tailwind';
    const projectPath = path.join(tempDir, projectName);

    // Run the generator
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    
    try {
      await generateProject({
        projectName,
        buildTool: 'Vite',
        language: 'JavaScript',
        stateManagement: 'Redux',
        styling: 'Tailwind',
      });
    } finally {
      process.chdir(originalCwd);
    }

    // Assertions
    expect(await fs.pathExists(projectPath)).toBe(true);

    // Verify package.json
    const pkg = await fs.readJson(path.join(projectPath, 'package.json'));
    expect(pkg.name).toBe(projectName);
    expect(pkg.dependencies).toHaveProperty('@reduxjs/toolkit');
    expect(pkg.dependencies).toHaveProperty('react-redux');
    expect(pkg.devDependencies).toHaveProperty('tailwindcss');
    expect(pkg.devDependencies).toHaveProperty('eslint');
    expect(pkg.devDependencies).toHaveProperty('prettier');
    expect(pkg.scripts).toHaveProperty('lint');
    expect(pkg.scripts).toHaveProperty('format');

    // Verify template copy
    expect(await fs.pathExists(path.join(projectPath, 'vite.config.js'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'src/App.jsx'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'src/main.jsx'))).toBe(true);

    // Verify state injection
    expect(await fs.pathExists(path.join(projectPath, 'src/store/store.js'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'src/store/counterSlice.js'))).toBe(true);
    
    // Verify main.jsx modification for Redux
    const mainContent = await fs.readFile(path.join(projectPath, 'src/main.jsx'), 'utf8');
    expect(mainContent).toContain("import { Provider } from 'react-redux';");
    expect(mainContent).toContain('<Provider store={store}>');

    // Verify App.jsx modification for Redux
    const appContent = await fs.readFile(path.join(projectPath, 'src/App.jsx'), 'utf8');
    expect(appContent).toContain("import { useSelector, useDispatch } from 'react-redux';");
    expect(appContent).toContain("useSelector((state) => state.counter.value)");
    expect(appContent).toContain("dispatch(increment())");

    // Verify Tailwind styling injection
    expect(await fs.pathExists(path.join(projectPath, 'tailwind.config.js'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'postcss.config.js'))).toBe(true);
    const cssContent = await fs.readFile(path.join(projectPath, 'src/index.scss'), 'utf8');
    expect(cssContent).toContain('@tailwind base;');

    // Verify Tooling configuration
    expect(await fs.pathExists(path.join(projectPath, '.eslintrc.cjs'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, '.prettierrc'))).toBe(true);
  });

  it('should generate a Webpack + TypeScript + Zustand + SCSS project correctly', async () => {
    const projectName = 'webpack-ts-zustand-scss';
    const projectPath = path.join(tempDir, projectName);

    // Run the generator
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    
    try {
      await generateProject({
        projectName,
        buildTool: 'Webpack',
        language: 'TypeScript',
        stateManagement: 'Zustand',
        styling: 'None',
      });
    } finally {
      process.chdir(originalCwd);
    }

    // Assertions
    expect(await fs.pathExists(projectPath)).toBe(true);

    // Verify package.json
    const pkg = await fs.readJson(path.join(projectPath, 'package.json'));
    expect(pkg.name).toBe(projectName);
    expect(pkg.dependencies).toHaveProperty('zustand');
    expect(pkg.dependencies).not.toHaveProperty('@reduxjs/toolkit');
    expect(pkg.devDependencies).not.toHaveProperty('tailwindcss');
    expect(pkg.devDependencies).toHaveProperty('@typescript-eslint/parser');

    // Verify Webpack & TS files
    expect(await fs.pathExists(path.join(projectPath, 'webpack.config.js'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'tsconfig.json'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'src/App.tsx'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'src/main.tsx'))).toBe(true);

    // Verify Zustand state injection
    expect(await fs.pathExists(path.join(projectPath, 'src/store/store.ts'))).toBe(true);

    // Verify App.tsx modification for Zustand
    const appContent = await fs.readFile(path.join(projectPath, 'src/App.tsx'), 'utf8');
    expect(appContent).toContain("import { useStore } from './store/store';");
    expect(appContent).toContain("useStore()");
    expect(appContent).toContain("increment()");

    // Verify Tailwind is NOT injected
    expect(await fs.pathExists(path.join(projectPath, 'tailwind.config.js'))).toBe(false);
    const cssContent = await fs.readFile(path.join(projectPath, 'src/index.scss'), 'utf8');
    expect(cssContent).not.toContain('@tailwind base;');
  });
});
