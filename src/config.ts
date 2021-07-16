import fs from 'fs';
import {load} from 'js-yaml';

type RerumNodeConfig = {
    hub: {
        serverUrl: string;
        roomToken: string;
        roomName: string;
        deviceId: string;
        deviceName: string;
    };
    commands: ('macos' | 'yeelight')[];
    misc: {
        debugSocket: boolean;
    };
}

// Ugly config load
export const config = load(fs.readFileSync(`${__dirname}/../config.yml`, 'utf8')) as RerumNodeConfig;
