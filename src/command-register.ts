import {combineLatest, Observable, Subject} from 'rxjs';
import {distinctUntilChanged, map, takeUntil} from 'rxjs/operators';
import {CommandRunner} from './model/command-runner';
import {IImperiumAction} from './model/imperium';
import {ICommand} from './model/satelles';

const commandsComparison = (c0: ICommand[], c1: ICommand[]) => JSON.stringify(c0) === JSON.stringify(c1);

export class CommandRegister {
    private runners: CommandRunner[] = [];
    private unsubscribeCommandUpdate$ = new Subject<void>();
    private sendCommandUpdate$ = new Subject<ICommand[]>();

    public get commands(): ICommand[] {
        return ([] as ICommand[]).concat(...this.runners.map(r => r.commands));
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return this.sendCommandUpdate$.pipe(
            distinctUntilChanged(commandsComparison),
        );
    }

    public registerRunner(runner: CommandRunner): void {
        console.log(`Registering runner: ${runner.name}`);
        runner.init();
        this.unsubscribeCommandUpdate$.next();
        this.runners.push(runner);

        combineLatest(this.runners.map(r => r.commandsUpdate$))
            .pipe(
                map(commandsArrays => ([] as ICommand[]).concat(...commandsArrays)),
                takeUntil(this.unsubscribeCommandUpdate$),
            )
            .subscribe(commands => this.sendCommandUpdate$.next(commands));
    }

    public connect(): void {
        for (const runner of this.runners) {
            runner.connect();
        }
    }

    public disconnect(): void {
        for (const runner of this.runners) {
            runner.disconnect();
        }
    }

    public onAction(action: IImperiumAction): void {
        for (const runner of this.runners) {
            runner.onAction(action);
        }
    }
}
