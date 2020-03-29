const fetch = require('node-fetch'),
    {parse} = require('papaparse'),
    table = process.stdout.isTTY ? require('table').table : require('markdown-table'),
    chalk = require('chalk');

const zero_padded = t => ('0' + t.toString()).slice(-2);

const formatted_date = (sub_days = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - sub_days);
    return `${zero_padded(d.getMonth() + 1)}-${zero_padded(d.getDate())}-${d.getFullYear()}`;
};

async function get_corona_data() {
    const latest_data = await fetch([
            'https:/',
            'api.github.com',
            'repos',
            'CSSEGISandData',
            'COVID-19',
            'contents',
            'csse_covid_19_data',
            'csse_covid_19_daily_reports',
        ].join('/')).then(r => r.json()),
        csv_index = latest_data.reduce((a, c) => c.name.endsWith('.csv')
            ? {...a, [c.name.split('.csv').shift()]: c}
            : a,
            {},
        );

    const {download_url} = csv_index[formatted_date()] || csv_index[formatted_date(1)],
        csv = await fetch(download_url).then(r => r.text());

    return parse(csv, {header: true}).data.filter(row => row.Country_Region === 'US');
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

const shades = [
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
];

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
                        if (!is_number(v) || !v)
                            return v;
                        const color = shades[Math.min(Math.floor(v / 111), 9)];
                        return chalk.hex(color)(v);
                    }))),
            ),
        );
    }
}

module.exports = {display_data};
