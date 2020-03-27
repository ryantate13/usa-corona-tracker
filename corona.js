const fs = require('fs'),
    fetch = require('node-fetch'),
    {parse} = require('papaparse'),
    table = process.stdout.isTTY ? require('table').table : require('markdown-table'),
    {redBright, blue, yellow} = require('chalk');

const zero_padded = t => ('0' + t.toString()).slice(-2);

const csv_url = (sub_days = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - sub_days);
    const formatted_date = `${zero_padded(d.getMonth() + 1)}-${zero_padded(d.getDate())}-${d.getFullYear()}`;
    return [
        'https:/',
        'raw.githubusercontent.com',
        'CSSEGISandData',
        'COVID-19',
        'master',
        'csse_covid_19_data',
        'csse_covid_19_daily_reports',
        `${formatted_date}.csv`
    ].join('/');
};

function get_corona_data() {
    return fetch(csv_url())
        .catch(() => fetch(csv_url(1)))
        .then(r => r.text())
        .then(csv => parse(csv, {header: true})
            .data
            .filter(row => row.Country_Region === 'US'));
}

const is_number = v => Number(v) == v;

function select(data, state) {
    const stats = ['Confirmed', 'Deaths', 'Recovered'],
        selected = state
            ?
            data.filter(row => row.Province_State.toLowerCase() === state.toLowerCase())
                .map(c => ({
                    County: c.Admin2,
                    ...stats.reduce((a, stat) => ({...a, [stat]: Number(c[stat])}), {}),
                    'Last Update': c.Last_Update,
                }))
            :
            Object.values(data.reduce((a, c) => {
                if (c.Province_State === 'Recovered')
                    return a;
                if (!a[c.Province_State]) {
                    a[c.Province_State] = {
                        State: c.Province_State,
                        ...stats.reduce((a, c) => ({...a, [c]: 0}), {}),
                        'Last Update': c.Last_Update,
                    };
                }
                for (const k of stats)
                    a[c.Province_State][k] += (c[k] ? Number(c[k]) : 0);
                return a;
            }, {}));
    if (!selected.length)
        return selected;
    const total = Object.entries(selected[0]).reduce((a, [k, v], i) => {
        if (!i)
            return {[k]: 'Total'};
        if (stats.includes(k))
            return {...a, [k]: selected.reduce((a, c) => a + c[k], 0)};
        return {...a, [k]: v};
    }, {});
    return [total].concat(selected);
}

async function display_data(state) {
    const data = await get_corona_data(),
        to_display = select(data, state);

    if (!to_display.length)
        console.error('No data found for ' + JSON.stringify(state));
    else {
        const sorted = to_display.sort((a, b) => b.Confirmed - a.Confirmed);
        return console.log(
            table(
                [Object.keys(sorted[0])]
                    .concat(sorted.map(row => Object.values(row).map(v => {
                        if (!is_number(v) || v === 0)
                            return v;
                        if (v >= 1000)
                            return redBright(v);
                        if (v >= 100)
                            return yellow(v);
                        return blue(v);
                    })))
            )
        );
    }
}

module.exports = {display_data};
