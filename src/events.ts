import {fromEvent, Observable} from 'rxjs';
import {tap} from 'rxjs/operators';
import {Socket} from 'socket.io-client';
import {config} from './config';
import {IImperiumAction} from './model/imperium';
import {IAnnounce, ICommand} from './model/satelles';


export interface ReceivedEventTypes {
    'connect': void;
    'disconnect': void;
    'imperium action': IImperiumAction;
}

export interface EmittedEventTypes {
    'satelles join': IAnnounce;
    'satelles exit': void;
    'satelles update': ICommand[];
}

export function fromEventTyped<T extends keyof ReceivedEventTypes>(
    target: Socket,
    eventName: T,
): Observable<ReceivedEventTypes[T]> {
    return fromEvent(target, eventName)
        .pipe(tap(data => config.misc.debugSocket && console.log(`socket> ${eventName}: ${JSON.stringify(data)}`)));
}

export function emitEvent<T extends keyof EmittedEventTypes>(
    emitter: Socket,
    eventName: T,
    ...data: Array<EmittedEventTypes[T]>
): void {
    if (config.misc.debugSocket) {
        console.log(`socket< ${eventName}: ${JSON.stringify(data[0])?.substr(0, 999)}`);
    }
    emitter.emit(eventName, ...data);
}
