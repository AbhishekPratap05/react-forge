# Create Forge React 🛠️

A modern, highly customizable boilerplate generator for React that **does not hide its configuration**. 

Tired of `create-react-app` burying your Webpack configuration? Create Forge React gives you the power to choose your stack and exposes every config file directly in your project root.

## Features

- **Build Tools**: Choose between lightning-fast **Vite** or raw, fully exposed **Webpack**.
- **Languages**: JavaScript or TypeScript.
- **State Management**: Optional injection of **Redux Toolkit** or **Zustand**.
- **Styling**: Built-in **SCSS** support out of the box, with an option to auto-inject **Tailwind CSS**.

## Usage

The recommended way to use Create Forge React is via standard NPM initializers (without prior installation):

```bash
npm create forge-react
# or
npm init forge-react
```

Alternatively, you can run it directly using `npx`:

```bash
npx create-forge-react
```

### Interactive Prompts

You will be presented with the following options:

1. **Project Name**: The directory that will be created.
2. **Build Tool**: Vite or Webpack.
3. **Language**: JavaScript or TypeScript.
4. **State Management**: None, Redux, or Zustand.
5. **Styling**: None (SCSS is default) or Tailwind CSS.

Once the generator finishes, navigate into your new project, install dependencies, and start coding:

```bash
cd your-project-name
npm install
npm run dev # or npm start for Webpack
```

## License

MIT
