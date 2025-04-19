import {Observable, Subject} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {config} from '../config';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';
import {GpioMock, GpioOrMock as Gpio} from '../utils/gpio-or-mock';
import {GpioConfig} from './gpio-model';

interface GpioRuntimeInfo {
    config: GpioConfig;
    gpio: GpioMock;
    state: 0 | 1;
}

export class GpioCommandRunner implements CommandRunner {
    private readonly sendCommandUpdate$ = new Subject<void>();

    private readonly gpios: GpioRuntimeInfo[] = (config.gpio || []).map(c => ({
        config: c,
        gpio: new Gpio(c.pin, {mode: Gpio.OUTPUT}),
        state: c.initialValue as 0 | 1 ?? 0,
    }));

    public get name(): string {
        return 'gpio';
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return this.sendCommandUpdate$.pipe(
            startWith(void 0),
            map(() => this.commands),
        );
    }

    public get commands(): ICommand[] {
        return this.gpios.flatMap(g => [
            {
                name: `${g.config.name}${g.state ? ' OFF' : ' ON'}`,
                type: 'action' as const,
            },
            ...(g.config.onForTimes || []).map(t => ({
                name: `${g.config.name} ${t}`,
                type: 'action' as const,
            })),
        ]);
    }

    public init(): void {
        this.gpios.forEach(g => this.writeGpio(g, g.state));
    }

    public connect(): void {
        return void 0;
    }

    public disconnect(): void {
        return void 0;
    }

    public onAction(action: IImperiumAction): void {
        console.log(`GpioCommandRunner.onAction: ${action.commandName}`);

        if (action.commandName.endsWith(' ON')) {
            const gpioName = action.commandName.slice(0, -3);
            const gpio = this.gpios.find(g => g.config.name === gpioName);
            this.writeGpio(gpio, 1);
        } else if (action.commandName.endsWith(' OFF')) {
            const gpioName = action.commandName.slice(0, -4);
            const gpio = this.gpios.find(g => g.config.name === gpioName);
            this.writeGpio(gpio, 0);
        } else {
            const hoursMatch = action.commandName.match(/ (\d+)h$/);
            if (hoursMatch) {
                const gpioName = action.commandName.split(' ').slice(0, -1).join(' ');
                const gpio = this.gpios.find(g => g.config.name === gpioName);
                if (gpio) {
                    const hours = parseInt(hoursMatch[1], 10);
                    const duration = hours * 60 * 60 * 1000;
                    this.writeGpio(gpio, 1);
                    setTimeout(() => {
                        this.writeGpio(gpio, 0);
                        this.sendCommandUpdate$.next();
                    }, duration);
                }
            }
        }
        this.sendCommandUpdate$.next();
    }

    private writeGpio(gpio: GpioRuntimeInfo | undefined, value: 0 | 1): void {
        if (!gpio) {
            return;
        }
        if (gpio.config.actOnMode) {
            if (value) {
                gpio.gpio.mode(Gpio.OUTPUT);
                gpio.gpio.digitalWrite(gpio.config.invert ? 1 - value : value);
            } else {
                gpio.gpio.mode(Gpio.INPUT);
            }
        } else {
            gpio.gpio.digitalWrite(gpio.config.invert ? 1 - value : value);
        }
        gpio.state = value;
    }
}
