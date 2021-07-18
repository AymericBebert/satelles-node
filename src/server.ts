import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';
import {CommandRegister} from './command-register';
import {config} from './config';
import {emitEvent, fromEventTyped} from './events';
import {commandRunnerFactory} from './modules';

const commandRegister = new CommandRegister();
for (const command of config.commands) {
    const runner = commandRunnerFactory(command);
    if (runner) {
        commandRegister.registerRunner(runner);
    }
}

console.log(`Starting satelles-node, connecting to ${config.hub.serverUrl}...`);
const socket: Socket = io(config.hub.serverUrl);

const connected$ = new Subject<void>();

fromEventTyped(socket, 'connect').subscribe(() => {
    console.log(`Connected to socket at ${config.hub.serverUrl}`);

    connected$.next();
    commandRegister.disconnect();
    commandRegister.connect();

    emitEvent(socket, 'satelles join', {
        token: config.hub.roomToken,
        roomName: config.hub.roomName,
        satelles: {
            id: config.hub.deviceId,
            name: config.hub.deviceName,
            commands: commandRegister.commands,
        },
    });

    commandRegister.commandsUpdate$
        .pipe(takeUntil(connected$))
        .subscribe(commands => emitEvent(socket, 'satelles update', commands));

    fromEventTyped(socket, 'imperium action')
        .pipe(takeUntil(connected$))
        .subscribe(action => commandRegister.onAction(action));

    fromEventTyped(socket, 'disconnect')
        .pipe(takeUntil(connected$))
        .subscribe(() => commandRegister.disconnect());
});
