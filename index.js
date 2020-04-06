#!/usr/bin/env node
const {display_data, get_corona_data, graphs, select, shader, map} = require('./corona');
const {states, get_state_abbreviation} = require('./states');

async function main(_state){
    const data = await get_corona_data(),
        state = (_state && _state.length === 2) ? states[_state.toUpperCase()] : _state,
        to_display = select(data, state),
        shade = shader(select(data)[1].Deaths);

    if (!to_display.length)
        return console.error('No data found for ' + JSON.stringify(state));

    if(process.stdout.isTTY){
        console.log(map(data, shade));
        console.log(await graphs(state, to_display, shade));
    }

    process.stdout.write(await display_data(
        to_display,
        state && get_state_abbreviation(state),
        process.stdout.isTTY,
        shade
    ));
}

main(process.argv[2]).catch(console.error);