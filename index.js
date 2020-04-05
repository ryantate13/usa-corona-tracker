#!/usr/bin/env node
const {display_data, get_corona_data, graphs, select, map} = require('./corona');
const {states, get_state_abbreviation} = require('./states');

async function main(_state){
    const data = await get_corona_data(),
        state = (_state && _state.length === 2) ? states[_state.toUpperCase()] : _state,
        to_display = select(data, state);

    if (!to_display.length)
        return console.error('No data found for ' + JSON.stringify(state));

    if(process.stdout.isTTY){
        console.log(map(data));
        console.log(await graphs(state));
    }

    console.log(await display_data(to_display, state && get_state_abbreviation(state), process.stdout.isTTY));
}

main(process.argv[2]).catch(console.error);