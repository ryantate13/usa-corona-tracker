const fetch = require('node-fetch'),
    {parse} = require('papaparse'),
    markdown_table = require('markdown-table'),
    cli_table = require('table').table,
    chalk = require('chalk'),
    chart = require('asciichart'),
    {maps, normalize_state} = require('./states');

async function get_corona_data() {
    const data = await Promise.all(['confirmed', 'deaths'].map(t => {
        const url = [
                'https://raw.githubusercontent.com',
                'CSSEGISandData',
                'COVID-19',
                'master',
                'csse_covid_19_data',
                'csse_covid_19_time_series',
                `time_series_covid19_${t}_US.csv`,
            ].join('/'),
            csv = fetch(url)
                .then(r => {
                    if (!r.ok)
                        throw new Error(`An error occurred retrieving ${url}`);
                    else
                        return r.text();
                })
                .then(t => t.trim())
                .then(csv => parse(csv, {header: true}).data);
        return Promise.all([t, csv]);
    }));
    return Object.fromEntries(data);
}

const delta = '∆',
    c1 = `Confirmed ${delta} 1 Day`,
    c7 = `Confirmed ${delta} 7 Day`,
    c30 = `Confirmed ${delta} 30 Day`,
    d1 = `Deaths ${delta} 1 Day`,
    d7 = `Deaths ${delta} 7 Day`,
    d30 = `Deaths ${delta} 30 Day`;

const int = n => Number.parseInt(n) || 0;

function select(data, state) {
    const dates = Object.keys(data.confirmed[0]).slice(-31),
        last_update = dates[dates.length - 1],
        one_day = dates[dates.length - 2],
        seven_day = dates[dates.length - 8],
        thirty_day = dates[0],
        blank = (k, v) => ({
            [k]: v,
            Confirmed: 0,
            [c1]: 0,
            [c7]: 0,
            [c30]: 0,
            Deaths: 0,
            [d1]: 0,
            [d7]: 0,
            [d30]: 0,
            'Last Update': last_update,
        }),
        selected = Object.values(Object.entries(data)
            .reduce((a, [stat, data_set]) => {
                const type = state ? 'County' : 'State',
                    csv_key = state ? 'Admin2' : 'Province_State';

                if (!a.Total)
                    a.Total = blank(type, 'Total');

                const keys = (stat === 'confirmed')
                    ?
                    ['Confirmed', c1, c7, c30]
                    :
                    ['Deaths', d1, d7, d30];

                data_set
                    .filter(row => row.Province_State === state || !state)
                    .forEach(row => {
                        if (!a[row[csv_key]])
                            a[row[csv_key]] = blank(type, row[csv_key]);
                        for (const k of ['Total', row[csv_key]])
                            [
                                last_update,
                                one_day,
                                seven_day,
                                thirty_day,
                            ].forEach((date, i) => a[k][keys[i]] += int(row[date]));
                    });
                return a;
            }, {}));

    for (const i of Object.keys(selected))
        for (const j of [c1, c7, c30, d1, d7, d30])
            selected[i][j] = selected[i][j.split(' ')[0]] - selected[i][j];

    return selected.sort((a, b) => b.Confirmed - a.Confirmed);
}

const shader = max_deaths => v => (v < 1) ? 'FFFFFF' : [
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
            [c]: shade(select(data, normalize_state(c))[0].Confirmed),
        }), {}),
        is_empty_unicode = c => !(c.trim()) || c.charCodeAt(0) === 10240,
        empty_color = '2B2B2b';

    return cli_table([
        ['Confirmed Cases Heat Map'],
        [
            usa.map((row, i) => {
                const px = [...row];
                return px.map((p, j) => {
                    if (is_empty_unicode(p))
                        return chalk.hex(empty_color)(p);
                    const states_that_have_pixel = states.filter(s => maps[s][i][j] && !is_empty_unicode(maps[s][i][j])),
                        shades = states_that_have_pixel.map(s => state_shades[s]);
                    return chalk.hex(shades.length ? average_shade(shades) : empty_color)(p);
                }).join('');
            }).join('\n'),
        ],
    ]);
}

function graphs(data, state) {
    const keys = Object.keys(data.confirmed[0]),
        dates = keys.filter(k => k.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)).slice(-100),
        padding = 10,
        chart_format = {
            height: 20,
            format(x) {
                return Math.floor(Number(x)).toLocaleString().padStart(padding).slice(-padding);
            },
        },
        time_series_data = Object.keys(data).reduce((a,c) => {
            const data_set = state ? data[c].filter(row => row.Province_State === state) : data[c],
                daily_totals = dates.map(d => data_set.map(row => Number(row[d])).reduce((a,b) => a+b));
            a[c] = daily_totals.map((t, i) => i ? t - daily_totals[i-1] : t);
            return a;
        }, {});

    return Object.keys(time_series_data).map(k => {
        const shade = shader(Math.max(...time_series_data[k])),
            plot = chart.plot(time_series_data[k], chart_format).split('\n')
                .map(line => {
                    const [total, graph] = line.split(/[┼┤]/),
                        numeric_total = Number(total.replace(/,/g, ''));
                    return line.replace(graph, chalk.hex(shade(numeric_total))(graph));
                }).join('\n');

        return cli_table([
            [
                `New ${k === 'confirmed' ? 'Confirmed Cases' : 'Deaths'} per Day - ${
                    [0, dates.length - 1].map(i => new Date(dates[i]).toLocaleDateString()).join(' through ')
                }`,
            ],
            [plot],
        ]);
    }).join('\n');
}

const is_number = v => typeof v === 'number';

function display_data(data, is_tty) {
    const table = is_tty ? cli_table : markdown_table,
        keys = Object.keys(data[0]),
        values = data.map(Object.values),
        shaders = values[0].map((v, i) => is_number(v)
            ? shader(Math.max(...values.slice(1).map(row => row[i])))
            : v => v);

    return table(
        [keys.map(k => k.includes(delta) ? delta + k.split(delta)[1] : k)]
            .concat(values.map(row => row.map((v, i) => {
                if(!is_number(v))
                    return v;
                const formatted = v.toLocaleString();
                return is_tty ? chalk.hex(shaders[i](v))(formatted) : formatted;
            }))),
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
