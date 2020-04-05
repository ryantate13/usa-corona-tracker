const fs = require('fs'),
    {execSync} = require('child_process'),
    stripAnsi = require('strip-ansi'),
    readme = text => fs.appendFileSync('README.md', `${text}\n\n`);

const {display_data, get_corona_data, select} = require('./corona');

(async () => {
    const corona_data = await get_corona_data(),
        state_list = new Set(
            corona_data
                .map(({Province_State}) => Province_State)
                .filter(s => s !== 'Recovered')
                .sort()
        );

    fs.writeFileSync('README.md', `# Corona Virus Tracker for USA

Fetches and displays most recent data from the [Johns Hopkins Data Repository on Github](https://github.com/CSSEGISandData/COVID-19)
via the CLI. Time series data for graphs is supplied by [The COVID Tracking Project](https://covidtracking.com/). Output
is displayed in the terminal. When ${'`'}process.stdout${'`'} is detected to be a TTY, output will be ANSI colorized and
displayed in a UTF8 table, otherwise the script will output Markdown to simplify piping between scripts or to a file.

The data set includes total confirmed cases, deaths, and recoveries. When viewing data for the entire USA, totals are
calculated for each state. When viewing data for an individual state, totals are shown per-county. In each case, the
top row will display the combined total. Data in the table is sorted by the total number of confirmed cases in descending order.
 
Data for ${
    new Date(
        corona_data[0].Last_Update,
    ).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
} is shown below.

## Installation

${'```bash'}
npm i -g @ryantate/corona-tracker
${'```'}

## Usage

### Show all data for the US
${'```bash'}
corona-tracker
${'```'}

### Show data for an individual state
${'```bash'}
corona-tracker 'New York'
${'```'}

### Get data for an individual county
${'```bash'}
corona-tracker oregon | grep -e Clackamas -e County -e --
${'```'}

#### Outputs the following Markdown

${
    execSync('node index.js oregon | grep -e Clackamas -e County -e --').toString()
}

`);

    const sep = '\n';
    readme('## USA');
    readme(sep + stripAnsi(await display_data(select(corona_data), null, false)) + sep);

    for (const state of state_list) {
        const state_data = select(corona_data, state);
        if(state_data.length){
            readme(`## ${state}`);
            readme(sep + stripAnsi(await display_data(state_data, null, false)) + sep);
        }
    }
})();
