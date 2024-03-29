import {interval, Observable, Subject, switchMap} from 'rxjs';
import {map, startWith, takeUntil} from 'rxjs/operators';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';
import {getVolume, sendToSleep, setVolume} from './macos-commands';

const MACOS_CONTROLS_NAME = 'macOS Controls';
const MACOS_SLEEP_NAME = 'Sleep';

export class MacOsCommandRunner implements CommandRunner {
    private sendCommandUpdate$ = new Subject<void>();
    private disconnected$ = new Subject<void>();

    private curVolume = 0;

    public get name(): string {
        return 'macos';
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return this.sendCommandUpdate$.pipe(
            startWith(void 0),
            map(() => this.commands),
        );
    }

    public get commands(): ICommand[] {
        return [
            {
                name: MACOS_CONTROLS_NAME,
                type: 'complex',
                args: [
                    {
                        name: 'Volume',
                        type: 'number',
                        numberValue: this.curVolume,
                        numberMin: 0,
                        numberMax: 100,
                        numberStep: 1,
                    },
                ],
            },
            {
                name: MACOS_SLEEP_NAME,
                type: 'action',
            },
        ];
    }

    public init(): void {
        console.debug('MacOsCommandRunner init');
    }

    public connect(): void {
        interval(10000)
            .pipe(
                startWith(0),
                switchMap(() => getVolume()),
                takeUntil(this.disconnected$),
            )
            .subscribe(volume => {
                if (volume !== null && volume !== this.curVolume) {
                    this.curVolume = volume;
                    this.sendCommandUpdate$.next();
                }
            });
    }

    public disconnect(): void {
        this.disconnected$.next();
    }

    public onAction(action: IImperiumAction): void {
        switch (action.commandName) {
            case MACOS_CONTROLS_NAME:
                (action.args || []).forEach(arg => {
                    if (arg.name == 'Volume') {
                        setVolume(arg?.numberValue ?? 10);
                    }
                });
                break;

            case MACOS_SLEEP_NAME:
                sendToSleep();
                break;
        }
    }
}
