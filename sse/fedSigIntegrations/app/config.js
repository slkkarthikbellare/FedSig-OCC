const path = require('path');

let envType = process.env['check_env_type'];
if (envType === '' || envType === undefined) {
    envType = process.env['NODE_ENV'];
}
console.log(`envType = ${envType}`);
if(!envType) {
    envType = process.env.OOD_SID;
}
let env = '';
switch (envType) {
    case 'p':
    case 'production': 
        env = 'production';
        break;
    case 's':
    case 'stage':
        env = 'stage';
        break;
    case 'tz52a0c0':
        env = "test";
        console.log("OOD_SID envType = test for tz52a0c0");
        break;
    case 'sz52a0c0':
        env = "stage";
        console.log("OOD_SID envType = stage for sz52a0c0");
        break;
    default:
        env = 'test';
}

console.log(`env = ${env}`);
const config = require('nconf') 
    .file(env, path.join(__dirname, '..', 'config', `default-${env}.json`))
    .file('default', path.join(__dirname, '..', 'config', `default.json`));

console.log(`occEnv:host = ${config.get('occEnv:host')}`); 

module.exports = config;
