#!/usr/bin/env node
const {display_data, get_corona_data, graphs, select, shader, map} = require('./corona');
const {normalize_state} = require('./states');

async function main(_state){
    const data = await get_corona_data(),
        state = normalize_state(_state),
        to_display = select(data, state),
        shade = shader(select(data)[1].Deaths),
        is_tty = process.stdout.isTTY || process.env.FORCE_COLOR;

    if (!to_display.length)
        return console.error('No data found for ' + JSON.stringify(state));

    if(is_tty){
        console.log(map(data, shade));
        console.log(await graphs(state, shade));
    }

    console.log(await display_data(to_display, is_tty, shade));
}

main(process.argv[2]).catch(console.error);
