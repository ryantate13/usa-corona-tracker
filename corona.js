const fetch = require('node-fetch'),
    {parse} = require('papaparse'),
    markdown_table = require('markdown-table'),
    cli_table = require('table').table,
    chalk = require('chalk'),
    chart = require('asciichart'),
    {maps, states: abbreviation_to_state} = require('./states');

async function get_corona_data() {
    try {
        const data = await Promise.all(['confirmed', 'deaths'].map(t => {
            const csv = fetch([
                    'https://raw.githubusercontent.com',
                    'CSSEGISandData',
                    'COVID-19',
                    'master',
                    'csse_covid_19_data',
                    'csse_covid_19_time_series',
                    `time_series_covid19_${t}_US.csv`,
                ].join('/'))
                    .then(r => {
                        if(!r.ok)
                            throw new Error('time_series csv failure');
                        else
                            return r.text();
                    })
                    .then(t => t.trim())
                    .then(csv => parse(csv, {header: true}).data);
            return Promise.all([t, csv]);
        }));
        return Object.fromEntries(data);
    }
    catch {
        return null;
    }
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

    return [total]
        .concat(selected)
        .sort((a, b) => b.Confirmed - a.Confirmed);
}

const shader = max_deaths => v => [
    'FFE5E5',
    'FFCCCC',
    'FFB3B3',
    'FF9999',
    'FF7F7F',
    'FF6666',
    'FF4D4D',
    'FF3333',
    'FF1A1A',
    'FF0000',
][Math.min(Math.floor(v / (max_deaths / 10)), 9)];

function average_shade(shades) {
    const rgb = [0, 0, 0];
    for (const shade of shades)
        shade.match(/.{2}/g).forEach((color, i) => rgb[i] += Buffer.from(color, 'hex')[0]);
    return rgb
        .map(c => Buffer.of(Math.round(c / shades.length)).toString('hex').toUpperCase())
        .join('');
}

function map(data, shade) {
    const {usa} = maps,
        states = Object.keys(maps).filter(k => k !== 'usa'),
        state_shades = states.reduce((a, c) => ({
            ...a,
            [c]: shade(select(data, abbreviation_to_state[c.toUpperCase()])[0].Confirmed),
        }), {}),
        is_empty_unicode = c => !(c.trim()) || c.charCodeAt(0) === 10240;

    return cli_table([
        ['Confirmed Cases Heat Map'],
        [
            usa.map((row, i) => {
                const px = [...row];
                return px.map((p, j) => {
                    if (is_empty_unicode(p))
                        return p;
                    const states_that_have_pixel = states.filter(s => maps[s][i][j] && !is_empty_unicode(maps[s][i][j])),
                        shades = states_that_have_pixel.map(s => state_shades[s]);
                    return chalk.hex(shades.length ? average_shade(shades) : '2B2B2b')(p);
                }).join('');
            }).join('\n'),
        ],
    ]);
}

function graphs(time_series_data, state, shade) {
    const days = 30,
        padding = 11,
        chart_format = {
            height: 20,
            format(x) {
                return Math.floor(Number(x)).toLocaleString().padStart(padding).slice(-padding);
            },
        };

    for (const t of Object.keys(time_series_data)) {
        time_series_data[t] = {};
        const dates = Object.keys(time_series_data[t]).slice(-days);

        for (const d of dates) {
            time_series_data[t][d] = 0;
            for (const row of state ? data.filter(row => row.Province_State === state) : data)
                time_series_data[t][d] += Number(row[d]) || 0;
        }
    }

    return cli_table([
        ['Confirmed Cases', 'Deaths'],
        Object.keys(time_series_data)
            .map(stat => {
                const plot_lines = chart.plot(Object.values(time_series_data[stat]), chart_format).split('\n');

                return plot_lines.map(line => {
                    const [total, graph] = line.split(/[┼┤]/),
                        numeric_total = Number(total.replace(/,/g, ''));
                    return line.replace(graph, chalk.hex(shade(numeric_total))(graph));
                }).join('\n');
            }),
        Object.entries({Start: 0, End: days - 1})
            .map(([t, i]) => `${t} Date: ${
                new Date(Object.keys(time_series_data.deaths)[i]).toLocaleDateString()
            }`),
    ]);
}

async function display_data(data, is_tty, shade) {
    const table = is_tty ? cli_table : markdown_table;

    return table(
        [Object.keys(data[0])]
            .concat(data.map(row => Object.values(row).map(v => (!is_tty || !is_number(v) || !v)
                ? v
                : chalk.hex(shade(v))(v.toLocaleString()),
            ))),
    ).trim();
}

module.exports = {
    display_data,
    get_corona_data,
    graphs,
    map,
    select,
    shader,
};
