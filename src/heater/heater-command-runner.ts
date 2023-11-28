import {Gpio} from 'pigpio';
import {Observable, of} from 'rxjs';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';
import {sendPulses} from './heater-commands';
import {signals as boostSignal} from './pulsefiles/2h_c_190';
import {signals as comfortSignal} from './pulsefiles/comfort_190_r';
import {signals as nightSignal} from './pulsefiles/night_170_r';
import {signals as standbySignal} from './pulsefiles/standby_070_r';

export class HeaterCommandRunner implements CommandRunner {
    private readonly outPin = 13;
    private readonly output: Gpio = new Gpio(this.outPin, {mode: Gpio.OUTPUT});

    public get name(): string {
        return 'heater';
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return of(this.commands);
    }

    public get commands(): ICommand[] {
        return [
            {
                name: 'Radiateur',
                type: 'info',
            },
            {
                name: 'Comfort',
                type: 'action',
            },
            {
                name: 'Night',
                type: 'action',
            },
            {
                name: 'Boost',
                type: 'action',
            },
            {
                name: 'Standby',
                type: 'action',
            },
        ];
    }

    public init(): void {
        this.output.digitalWrite(0);
    }

    public connect(): void {
    }

    public disconnect(): void {
    }

    public onAction(action: IImperiumAction): void {
        switch (action.commandName) {
            case 'Comfort':
                sendPulses(this.outPin, comfortSignal);
                break;
            case 'Night':
                sendPulses(this.outPin, nightSignal);
                break;
            case 'Boost':
                sendPulses(this.outPin, boostSignal);
                break;
            case 'Standby':
                sendPulses(this.outPin, standbySignal);
                break;
        }
    }
}
