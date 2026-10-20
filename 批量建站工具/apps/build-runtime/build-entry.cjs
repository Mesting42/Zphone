'use strict';
const path = require('node:path');

// Execute the imported project's real build/prebuild/postbuild scripts. Workers
// inherit the packaged Node executable and offline guard; native containers supply
// platform command adapters so npm never depends on a user's system Node install.
const project = process.argv[2];
process.chdir(project);
process.argv = [process.execPath, process.env.SITEFOUNDRY_NPM_CLI, 'run', 'build', '--offline'];
require(process.argv[1]);
