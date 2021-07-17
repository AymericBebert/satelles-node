import {Observable} from 'rxjs';
import {IImperiumAction} from './imperium';
import {ICommand} from './satelles';

export interface CommandRunner {
    get name(): string

    get commands(): ICommand[]

    get commandsUpdate$(): Observable<ICommand[]>

    init(): void

    onAction(action: IImperiumAction): void
}
