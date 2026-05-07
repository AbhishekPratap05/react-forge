#!/usr/bin/env node

import { runCLI } from '../lib/index.js';

runCLI().catch((err) => {
  console.error('An unexpected error occurred:', err);
  process.exit(1);
});
