#!/usr/bin/env node
const {display_data} = require('./corona');

display_data(process.argv[2]).catch(console.error);
