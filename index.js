#!/usr/bin/env node
const {display_data, get_corona_data, graphs, select, shader, map} = require('./corona'),
    {normalize_state} = require('./states'),
    upgrade_notice = require('./upgrade_notice');

const usage = `Usage: corona-tracker <state>
    state (optional)  Show stats for a specific state instead of full USA. Full state name or abbreviation
    -h | --help       Show this help message and quit
    -v | --version    Show package version and quit`;

async function main(_state){
    if(process.argv.includes('-v') || process.argv.includes('--version')){
        const {version, name} = require('./package.json');
        console.log(name, version);
        process.exit();
    }
    else if(process.argv.includes('-h') || process.argv.includes('--help')){
        console.log(usage);
        process.exit();
    }
    const data = await get_corona_data(),
        state = normalize_state(_state),
        to_display = select(data, state),
        is_tty = process.stdout.isTTY || process.env.FORCE_COLOR;

    if (!to_display.length)
        return console.error('No data found for ' + JSON.stringify(state));

    if(is_tty){
        console.log(map(data));
        console.log(graphs(data, state));
    }

    console.log(display_data(to_display, is_tty));
    await upgrade_notice(is_tty);
}

main(process.argv[2]).catch(console.error);
