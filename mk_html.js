const fs = require('fs'),
    path = require('path'),
    cli_table = require('table').table,
    AU = require('ansi_up'),
    ansi_up = new AU.default,
    {display_data, get_corona_data, graphs, map, select, shader} = require('./corona');

const html = (nav, [us_map, graphs, table], states) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>USA Corona Tracker</title>
    <meta name='date' content='${new Date().toLocaleDateString()}'>
    <link rel="stylesheet" href="./style.css">
    <style>
        html, a, pre {
            background: #2B2B2b;
            color: #f8f8f8;
            font-family: FreeMono, monospace;
        }
        pre {
            margin: 0;
        }
        h1 {  
            margin: 0 10px;
        }
        td {
            vertical-align: top;
        }
    </style>
</head>
<body>
<h1>USA Corona Tracker</h1>
<table>
<tr>
<td>
<pre>
${nav}
</pre>
</td>
<td>
<a id="usa"></a>
<pre>
${us_map}
${graphs}
${table}
</pre>
${states.join('\n')}
</td>
</tr>
</table>
</body>
</html>`;

const id = s => s.replace(/\s+/g, '-').toLowerCase();

(async () => {
    const data = await get_corona_data(),
        states = [...new Set(data.deaths.map(({Province_State}) => Province_State))].sort(),
        to_display = select(data),
        shade = shader(to_display[1].Deaths),
        nav_entries = ['USA'].concat(states);

    let nav = cli_table([
        ['Nav'],
        [nav_entries.join('\n')],
    ]);
    nav_entries.forEach(s => {
        nav = nav.replace(s, `<a href="#${id(s)}">${s}</a>`);
    });

    const index = html(
        nav,
        [
            map(data, shade),
            graphs(data),
            display_data(to_display, true),
        ].map(s => ansi_up.ansi_to_html(s)),
        states.map(s => [
            `<h2 id="${id(s)}">${s}</h2>`,
            `<pre>${ansi_up.ansi_to_html(graphs(data, s))}</pre>`,
            `<pre>${ansi_up.ansi_to_html(display_data(select(data, s), true))}</pre>`,
        ].join('\n')),
    );

    fs.writeFileSync(path.join(__dirname, 'index.html'), index);
})();