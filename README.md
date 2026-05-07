# React Forge 🛠️

A modern, highly customizable boilerplate generator for React that **does not hide its configuration**. 

Tired of `create-react-app` burying your Webpack configuration? React Forge gives you the power to choose your stack and exposes every config file directly in your project root.

## Features

- **Build Tools**: Choose between lighting-fast **Vite** or raw, fully exposed **Webpack**.
- **Languages**: JavaScript or TypeScript.
- **State Management**: Optional injection of **Redux Toolkit** or **Zustand**.
- **Styling**: Built-in **SCSS** support out of the box, with an option to auto-inject **Tailwind CSS**.

## Installation (Local Testing)

1. Clone or download this repository.
2. Install the CLI dependencies:
   ```bash
   npm install
   ```
3. Link the package globally so you can use the command anywhere:
   ```bash
   npm link
   ```

## Usage

Run the generator in any directory:

```bash
react-forge
```

You will be presented with interactive prompts:

1. **Project Name**: The directory that will be created.
2. **Build Tool**: Vite or Webpack.
3. **Language**: JavaScript or TypeScript.
4. **State Management**: None, Redux, or Zustand.
5. **Styling**: None (SCSS is default) or Tailwind CSS.

Once the generator finishes:

```bash
cd your-project-name
npm install
npm run dev
```

## Publishing to NPM

When you are ready to publish this tool so others can use it via `npx`:

1. Ensure you are logged into NPM: `npm login`
2. Run `npm publish` from the root of this project.
3. Others can now run: `npx react-forge-cli` (or whatever name you publish it under).
