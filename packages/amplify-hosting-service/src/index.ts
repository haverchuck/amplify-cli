import { AmplifyConsole } from './core';
import { AmplifyContext } from './types';

let amplifyConsole: AmplifyConsole;

async function add(context: AmplifyContext): Promise<void> {
    initClient(context);
    return amplifyConsole.add();
}

async function publish(context: AmplifyContext): Promise<void> {
    initClient(context);
    return amplifyConsole.publish();
}

async function remove(context: AmplifyContext): Promise<void> {
    initClient(context);
    return amplifyConsole.remove();
}

async function status(context: AmplifyContext): Promise<void> {
    initClient(context);
    return amplifyConsole.status();
}

async function configure(context: AmplifyContext): Promise<void> {
    initClient(context);
    return amplifyConsole.configure();
}

async function console(context: AmplifyContext): Promise<void> {
    initClient(context);
    return await amplifyConsole.console();
}

function initClient(context: AmplifyContext) {
    if (!amplifyConsole) {
        amplifyConsole = new AmplifyConsole(context);
    }
}

export {
    add,
    publish,
    remove,
    status,
    configure,
    console
}