# React Forge 🛠️

A modern, highly customizable boilerplate generator for React that **does not hide its configuration**. 

Tired of `create-react-app` burying your Webpack configuration? React Forge gives you the power to choose your stack and exposes every config file directly in your project root.

## Features

- **Build Tools**: Choose between lightning-fast **Vite** or raw, fully exposed **Webpack**.
- **Languages**: JavaScript or TypeScript.
- **State Management**: Optional injection of **Redux Toolkit** or **Zustand**.
- **Styling**: Built-in **SCSS** support out of the box, with an option to auto-inject **Tailwind CSS**.

## Usage

The easiest way to use React Forge is via `npx`, which ensures you are always using the latest version. Run the following command in your terminal where you want to create your new project:

```bash
npx react-forge
```

You will be presented with interactive prompts:

1. **Project Name**: The directory that will be created.
2. **Build Tool**: Vite or Webpack.
3. **Language**: JavaScript or TypeScript.
4. **State Management**: None, Redux, or Zustand.
5. **Styling**: None (SCSS is default) or Tailwind CSS.

Once the generator finishes, navigate into your new project and start coding:

```bash
cd your-project-name
npm install
npm run dev
```

## Global Installation (Optional)

If you prefer to install the CLI globally on your machine, you can do so via npm:

```bash
npm install -g react-forge
```

Then you can run the generator anywhere using:

```bash
react-forge
```

## License

MIT
