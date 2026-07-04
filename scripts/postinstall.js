import chalk from 'chalk';

function main() {
  console.log('\n' + chalk.cyan('='.repeat(60)));
  console.log(chalk.bold.green('   React Forge Builder has been installed successfully! 🛠️'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log('\nTo start the interactive React boilerplate generator, run:');
  console.log(chalk.bold.yellow('   npx react-forge-builder\n'));
  console.log(chalk.gray('Or install it globally to run it directly:'));
  console.log(chalk.gray('   npm install -g react-forge-builder'));
  console.log(chalk.gray('   react-forge-builder\n'));
  console.log(chalk.cyan('='.repeat(60)) + '\n');
}

main();
