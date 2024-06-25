import noble, {Peripheral} from '@abandonware/noble';
import {EEventEmitter} from './events';

export default class Scanner extends EEventEmitter<{
    discover: [noble.Peripheral]
}> {
    services: string[];
    private clean?: () => void;

    constructor(services: string[]) {
        super();
        this.services = services;
    }

    async startScanning() {
        console.log('Starting scanning check', noble._state);
        if (noble._state !== 'poweredOn') {
            await new Promise<void>((resolve, reject) => {
                noble.once('stateChange', (state) => {
                    if (state === 'poweredOn') {
                        resolve();
                    } else {
                        reject(new Error('Noble is not powered on'));
                    }
                });
            });
        }
        console.log('Starting scanning');
        await noble.startScanningAsync(this.services, false);
        const listener = (peripheral: Peripheral) => {
            this.emit('discover', peripheral);
        };
        noble.on('discover', listener);
        this.clean = () => {
            noble.removeListener('discover', listener);
        };
    }

    async stopScanning() {
        await noble.stopScanningAsync();
        this.clean?.();
    }
}
