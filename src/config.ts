import fs from 'fs';
import {load} from 'js-yaml';
import {GpioConfig} from './gpio/gpio-model';

type RerumNodeConfig = {
    hub: {
        serverUrl: string;
        roomToken: string;
        roomName: string;
        deviceId: string;
        deviceName: string;
    };
    commands: string[];
    misc: {
        debugSocket: boolean;
    };
    gpio?: GpioConfig[];
}

// Ugly config load
export const config = load(fs.readFileSync(`${__dirname}/../config.yml`, 'utf8')) as RerumNodeConfig;
