import {Peripheral} from '@abandonware/noble';
import {concatMap, Observable, of, Subject} from 'rxjs';
import {config} from '../config';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';
import {Client} from './client';
import {HueScenario} from './model';
import Scanner from './scanner';

export class HueCommandRunner implements CommandRunner {
    private scanner: Scanner | undefined;
    private lamps: Peripheral[] = [];
    private clients: Client[] = [];

    private readonly lampDiscovered$ = new Subject<Peripheral>();
    private readonly scenarioNames = new Set<string>(config.hue?.scenarios?.map(scenario => scenario.name) || []);
    private readonly scenarios = new Map<string, HueScenario>(config.hue?.scenarios.map(scenario => [scenario.name, scenario]) || []);

    public get name(): string {
        return 'hue';
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return of(this.commands);
    }

    public get commands(): ICommand[] {
        return [
            {
                name: 'Philips Hue',
                type: 'info',
            },
            {
                name: 'On',
                type: 'action',
            },
            {
                name: 'Off',
                type: 'action',
            },
            ...[...this.scenarioNames].map(name => ({
                name,
                type: 'action' as const,
            })),
            {
                name: 'Hue Control',
                type: 'complex',
                args: [
                    {
                        name: 'Brightness',
                        type: 'number',
                        // numberValue: yl.bright,
                        numberMin: 1,
                        numberMax: 100,
                        numberStep: 1,
                    },
                    {
                        name: 'Temperature',
                        type: 'number',
                        // numberValue: yl.bright,
                        numberMin: 1,
                        numberMax: 100,
                        numberStep: 1,
                    },
                ],
            },
        ];
    }

    public init(): void {
        this.lampDiscovered$.pipe(
            concatMap(peripheral => {
                this.lamps.push(peripheral);
                console.log(`Connecting to: \x1b[35m${peripheral.advertisement.localName}\x1b[0m (${peripheral.id})`);
                const client = new Client(peripheral);
                return client.connect()
                    .then(() => client.getLampName())
                    .then(lampName => {
                        console.log('Connected to', lampName);
                        return client;
                    });
            }),
        ).subscribe(client => {
            this.clients.push(client);
            // client.getBrightness();
        });
    }

    public connect(): void {
        const stopCurrentScanning = this.scanner ? this.scanner.stopScanning() : Promise.resolve();
        stopCurrentScanning
            .then(() => Client.scanForLamps())
            .then(scanner => {
                this.scanner = scanner;
                this.scanner.on('discover', peripheral => {
                    console.log(`Found lamp: \x1b[35m${peripheral.advertisement.localName}\x1b[0m (${peripheral.id})`);
                    this.lampDiscovered$.next(peripheral);
                });
            })
            .catch(err => console.error('Could not scan for lamps', err));
    }

    public disconnect(): void {
        this.scanner?.stopScanning().catch(err => console.error('Could not stop scanning', err));
    }

    public onAction(action: IImperiumAction): void {
        const knownScenario = this.scenarios.get(action.commandName);
        if (knownScenario) {
            for (const client of this.clients) {
                const lamp = knownScenario.lamps.find(lamp => lamp.name === client.peripheral.advertisement.localName);
                if (lamp) {
                    client.setBrightness(lamp.brightness).catch(err => console.error('Could not set brightness', err));
                    client.setTemperature(lamp.temperature).catch(err => console.error('Could not set temperature', err));
                }
            }
        } else if (action.commandName === 'Hue Control') {
            (action.args || []).forEach(arg => {
                if (arg.name == 'Brightness' && arg.numberValue) {
                    for (const client of this.clients) {
                        client.setBrightness(arg.numberValue).catch(err => console.error('Could not set brightness', err));
                    }
                }
                if (arg.name == 'Temperature' && arg.numberValue) {
                    for (const client of this.clients) {
                        client.setTemperature(arg.numberValue).catch(err => console.error('Could not set temperature', err));
                    }
                }
            });
        }
    }
}
