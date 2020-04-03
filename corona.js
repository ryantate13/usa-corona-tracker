const fetch = require('node-fetch'),
    {parse} = require('papaparse'),
    markdown_table = require('markdown-table'),
    cli_table = require('table').table,
    chalk = require('chalk'),
    chart = require('asciichart');

const zero_padded = t => ('0' + t.toString()).slice(-2);

const csv_url = (sub_days = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - sub_days);
    return [
        'https:/',
        'raw.githubusercontent.com',
        'CSSEGISandData',
        'COVID-19',
        'master',
        'csse_covid_19_data',
        'csse_covid_19_daily_reports',
        `${zero_padded(d.getMonth() + 1)}-${zero_padded(d.getDate())}-${d.getFullYear()}.csv`
    ].join('/');
};

async function get_corona_data() {
    let csv,
        sub_days = 0;

    while (!csv) {
        csv = await fetch(csv_url(sub_days)).then(r => r.ok ? r.text() : null);
        ++sub_days;
    }

    return parse(csv, {header: true})
        .data.
        filter(row => row.Country_Region === 'US');
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

const shade = v => [
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
][Math.min(Math.floor(v / 111), 9)];

const GRAPH_PADDING = 8;

async function display_data(data, state, is_tty) {
    const table = is_tty ? cli_table : markdown_table,
        sorted = data.sort((a, b) => b.Confirmed - a.Confirmed);

    let output = '';

    if (is_tty) {
        const time_series_url = 'https://covidtracking.com/api/' + (
                state
                    ?
                    `states/daily?state=${state}`
                    :
                    'us/daily'
            ),
            time_series_data = (await fetch(time_series_url).then(r => r.json())).reverse(),
            chart_format = {
                height: 20,
                format(x) {
                    return Math.floor(Number(x)).toLocaleString().padStart(GRAPH_PADDING).slice(-GRAPH_PADDING);
                },
            };

        output += table([
            ['Confirmed', 'Deaths'],
            ['positive', 'death']
                .map(stat => {
                    const stats = time_series_data.map(r => r[stat] || 0),
                        plot_lines = chart.plot(stats, chart_format).split('\n');

                    return plot_lines.map((line, i) => {
                        const [total, graph] = line.split(/[┼┤]/),
                            numeric_total = Number(total.replace(/,/g, '')),
                            colorized = line.replace(graph, chalk.hex(shade(numeric_total))(graph));

                        switch(i){
                            case 0:
                                return colorized
                                    .replace(total, chart_format
                                        .format(sorted[0][stat === 'death' ? 'Deaths' : 'Confirmed']) + ' ');
                            case (plot_lines.length - 1):
                                return colorized
                                    .replace(total, chart_format.format(stats[0]) + ' ');
                            default:
                                return colorized;
                        }
                    }).join('\n');
                }),
            Object.entries({Start: 0, End: time_series_data.length - 1})
                .map(([t, i]) => `${t} Date: ${
                    new Date(time_series_data[i].dateChecked).toLocaleDateString()
                }`),
        ]);
    }

    return output + table(
        [Object.keys(sorted[0])]
            .concat(sorted.map(row => Object.values(row).map(v => {
                if (!is_number(v) || !v)
                    return v;
                return chalk.hex(shade(v))(v.toLocaleString());
            }))),
    );
}

module.exports = {display_data, get_corona_data, select};
