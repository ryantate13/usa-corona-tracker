const fetch = require('node-fetch'),
    chalk = require('chalk'),
    {version, name} = require('./package.json');

module.exports = async function upgrade_notice(is_tty){
    if(!is_tty)
        return;
    const res = await fetch('https://registry.npmjs.org/@' + encodeURIComponent(name.slice(1)));
    if(!res.ok)
        return;
    try{
        const registry_info = await res.json(),
            {latest} = registry_info['dist-tags'];
        if(latest !== version)
            console.log(chalk.green([
                `A newer version of corona-tracker is available!`,
                `Upgrade to version ${latest} by running \`npm i -g ${name}\``
            ].join('\n')));
    }
    catch{}
};