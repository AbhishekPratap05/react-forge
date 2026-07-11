import chalk from 'chalk';

function main() {
  console.log('\n' + chalk.cyan('='.repeat(60)));
  console.log(chalk.bold.green('   Create Forge React has been installed successfully! 🛠️'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log('\nTo start the interactive React boilerplate generator, run:');
  console.log(chalk.bold.yellow('   npx create-forge-react\n'));
  console.log(chalk.gray('Or run it directly using the initializer:'));
  console.log(chalk.gray('   npm create forge-react\n'));
  console.log(chalk.cyan('='.repeat(60)) + '\n');
}

main();
