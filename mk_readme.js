const fs = require('fs'),
    stripAnsi = require('strip-ansi'),
    readme = text => fs.appendFileSync('README.md', `${text}\n\n`),
    states = require('./states');

console.log = s => s;
process.stdout.isTTY = false;

const {display_data} = require('./corona');

fs.writeFileSync('README.md', `# Corona Virus Tracker for USA

Fetches and displays most recent data from the [Johns Hopkins Data Repository on Github](https://github.com/CSSEGISandData/COVID-19)
via the CLI. Output is displayed in the terminal. When ${'`'}process.stdout${'`'} is detected to be a TTY, output will
be ANSI colorized and displayed in a UTF8 table, otherwise the script will output Markdown to simplify piping between
scripts or to a file.

The data set includes total confirmed cases, deaths, and recoveries. When viewing data for the entire USA, totals are
calculated for each state. When viewing data for an individual state, totals are shown per-county. In each case, the
top row will display the combined total. Data in the table is sorted by the total number of confirmed cases in descending order.
 
Data for ${new Date().toLocaleString().split(',').shift()} is shown below.

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
corona-tracker oregon | grep -e Clackamas -e County -e '--' | cat
${'```'}

`);

(async () => {
    const sep = '\n';
    readme('## USA');
    readme(sep + stripAnsi(await display_data()) + sep);

    for(const state of states){
        readme(`## ${state}`);
        readme(sep + stripAnsi(await display_data(state)) + sep);
    }
})();
