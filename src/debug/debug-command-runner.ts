import {Observable, Subject} from 'rxjs';
import {map, startWith, takeUntil} from 'rxjs/operators';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';

export class DebugCommandRunner implements CommandRunner {
    private sendCommandUpdate$ = new Subject<void>();

    private actionNumber = 0;
    private stringValue = 'Bonsoir';
    private numberValue = 42;
    private booleanValue = false;
    private colorValue = '#541caa';
    private selectValue = 'Cats';

    public get name(): string {
        return 'debug';
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
                name: `Info ${this.actionNumber}`,
                type: 'info',
            },
            {
                name: 'Action',
                type: 'action',
            },
            {
                name: 'Complex',
                type: 'complex',
                args: [
                    {
                        name: 'String',
                        type: 'string',
                        stringValue: this.stringValue,
                    },
                    {
                        name: 'Number',
                        type: 'number',
                        numberValue: this.numberValue,
                        numberMin: 0,
                        numberMax: 100,
                        numberStep: 5,
                    },
                    {
                        name: 'Boolean',
                        type: 'boolean',
                        booleanValue: this.booleanValue,
                    },
                    {
                        name: 'Color',
                        type: 'color',
                        colorValue: this.colorValue,
                    },
                    {
                        name: 'Select',
                        type: 'select',
                        selectValue: this.selectValue,
                        selectOptions: ['Dogs', 'Cats', 'Camels'],
                    },
                ],
            },
        ];
    }

    public init(): void {
        console.debug('Init');
    }

    public connect(): void {
        console.debug('Connected');
    }

    public disconnect(): void {
        console.debug('Disconnected');
    }

    public onAction(action: IImperiumAction): void {
        // console.log(action);

        switch (action.commandName) {
            case 'Action':
                this.actionNumber += 1;
                this.sendCommandUpdate$.next();
                break;

            case 'Complex':
                (action.args || []).forEach(arg => {
                    switch (arg.name) {
                        case 'String':
                            this.stringValue = arg.stringValue ?? '';
                            break;
                        case 'Number':
                            this.numberValue = arg.numberValue ?? 0;
                            break;
                        case 'Boolean':
                            this.booleanValue = arg.booleanValue ?? false;
                            break;
                        case 'Color':
                            this.colorValue = arg.colorValue ?? '#aaaaaa';
                            break;
                        case 'Select':
                            this.selectValue = arg.selectValue ?? '';
                            break;
                    }
                });
                this.sendCommandUpdate$.next();
                break;
        }
    }
}
