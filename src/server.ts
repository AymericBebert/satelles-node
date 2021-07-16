import {BehaviorSubject, interval, of, Subject} from 'rxjs';
import {delay, distinctUntilChanged, filter, map, startWith, switchMap, take, takeUntil, tap} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';
import {
    getVolume,
    MACOS_CONTROLS_NAME,
    MACOS_SLEEP_NAME,
    macosCommands,
    sendToSleep,
    setVolume,
} from './commands/macos-commands';
import {yeelightCommands} from './commands/yeelight';
import {config} from './config';
import {emitEvent, fromEventTyped} from './events';
import {
    LightSetBrightMessage,
    LightSetCtMessage,
    LightSetHsvMessage,
    LightSetPowerMessage,
    LightSetRgbMessage,
} from './model/light-messages';
import {ICommand} from './model/satelles';
import {Lookup} from './ts-yeelight-wifi/lookup';
import {Yeelight} from './ts-yeelight-wifi/yeelight';

console.log(`Starting satelles-node, connecting to ${config.hub.serverUrl}...`);
const socket: Socket = io(config.hub.serverUrl);

const commandsComparison = (c0: ICommand[], c1: ICommand[]) => JSON.stringify(c0) === JSON.stringify(c1);
const yeelightState = (yl: Yeelight) => ({
    id: yl.id,
    power: yl.power,
    bright: yl.bright,
    rgb: yl.rgb,
});
const ylStatesHash = (s: { [id: string]: Yeelight }) => JSON.stringify(Object.values(s).map(y => yeelightState(y)));
const yeelightStatesComparison = (s0: { [id: string]: Yeelight }, s1: { [id: string]: Yeelight }) => {
    return ylStatesHash(s0) === ylStatesHash(s1);
};

const connected$ = new Subject<void>();

fromEventTyped(socket, 'connect').subscribe(() => {
    console.log(`Connected to socket at ${config.hub.serverUrl}`);

    connected$.next();

    let curVolume = 0;
    const ylState = Object.values(curLightState$.getValue())[0] || null;

    emitEvent(socket, 'satelles join', {
        token: config.hub.roomToken,
        roomName: config.hub.roomName,
        satelles: {
            id: config.hub.deviceId,
            name: config.hub.deviceName,
            commands: [
                ...(config.commands.indexOf('macos') > -1 ? macosCommands(0) : []),
                ...(config.commands.indexOf('yeelight') > -1 ? yeelightCommands(ylState) : []),
            ],
        },
    });

    if (config.commands.indexOf('macos') > -1) {
        interval(10000)
            .pipe(
                switchMap(() => getVolume()),
                tap(cv => {
                    if (cv !== null && cv !== curVolume) {
                        curVolume = cv;
                    }
                }),
                map(() => {
                    const ylState = Object.values(curLightState$.getValue())[0] || null;
                    return [
                        ...(config.commands.indexOf('macos') > -1 ? macosCommands(curVolume) : []),
                        ...(config.commands.indexOf('yeelight') > -1 ? yeelightCommands(ylState) : []),
                    ];
                }),
                distinctUntilChanged(commandsComparison),
                takeUntil(connected$),
            )
            .subscribe(commands => emitEvent(socket, 'satelles update', commands));
    }

    if (config.commands.indexOf('yeelight') > -1) {
        lookup$.next();

        curLightState$
            .pipe(
                map(states => Object.values(states)[0] || null),
                map(yl => [
                    ...(config.commands.indexOf('macos') > -1 ? macosCommands(curVolume) : []),
                    ...(config.commands.indexOf('yeelight') > -1 ? yeelightCommands(yl) : []),
                ]),
                distinctUntilChanged(commandsComparison),
                takeUntil(connected$),
            )
            .subscribe(commands => emitEvent(socket, 'satelles update', commands));
    }
});

fromEventTyped(socket, 'imperium action').subscribe(action => {
    switch (action.commandName) {
        case MACOS_CONTROLS_NAME :
            (action.args || []).forEach(arg => {
                if (arg.name == 'Volume') {
                    setVolume(arg?.numberValue ?? 10);
                }
            });
            break;

        case MACOS_SLEEP_NAME :
            sendToSleep();
            break;

        case 'YL Turn On':
            setPower$.next({power: true, duration: 200});
            break;

        case 'YL Turn Off':
            setPower$.next({power: false, duration: 200});
            break;

        case 'YL Blink':
            blink$.next();
            break;

        case 'YL Control':
            (action.args || []).forEach(arg => {
                if (arg.name == 'Brightness') {
                    setBright$.next({bright: arg.numberValue || 50, duration: 200});
                }
                if (arg.name == 'Temperature') {
                    setCT$.next({ct: arg.numberValue || 2500, duration: 200});
                }
            });
            break;
    }
});

// Lights commands
const setPower$ = new BehaviorSubject<LightSetPowerMessage | null>(null);
const setRGB$ = new BehaviorSubject<LightSetRgbMessage | null>(null);
const setHSV$ = new BehaviorSubject<LightSetHsvMessage | null>(null);
const setCT$ = new BehaviorSubject<LightSetCtMessage | null>(null);
const setBright$ = new BehaviorSubject<LightSetBrightMessage | null>(null);
const blink$ = new Subject<void>();
const lookup$ = new Subject<void>();
const lookupReset$ = new Subject<void>();
const curLightState$ = new BehaviorSubject<{ [id: string]: Yeelight }>({});

curLightState$
    .pipe(distinctUntilChanged(yeelightStatesComparison))
    .subscribe(cls => {
        if (Object.keys(cls).length === 0) {
            console.log('YL States is empty');
            return;
        }
        console.log(`YL States of the ${Object.keys(cls).length} entries:`);
        Object.keys(cls).forEach(k => {
            const l = cls[k];
            const rgb = `R ${Math.round(l.rgb.r)}, G ${Math.round(l.rgb.g)}, B ${Math.round(l.rgb.b)}`;
            console.log(`YL State of ${k}: power ${l.power ? 'ON' : 'OFF'}, ${rgb}`);
        });
        console.log('-----');
    });

// Utils for lights

function onOperationSuccess() {
    // console.log('success');
}

function onOperationFailed(error: string) {
    console.log(`failed: ${error}`);
}

function valueNotNull<T>(value: null | undefined | T): value is T {
    return value !== null && value !== undefined;
}

function blinkLight(light: Yeelight) {
    const curState = light.getState();
    of(null).pipe(
        tap(() => !curState.power && light.setPower(true, 200).catch(onOperationFailed)),
        tap(() => light.setBright(1, 200).catch(onOperationFailed)),
        delay(200),
        tap(() => light.setBright(100, 200).catch(onOperationFailed)),
        delay(200),
        tap(() => light.setBright(curState.bright, 200).catch(onOperationFailed)),
        tap(() => !curState.power && light.setPower(false, 200).catch(onOperationFailed)),
    ).subscribe();
}

// Communication with lights

const look: Lookup = new Lookup(20 * 1000, false);

const connectedLights$ = new BehaviorSubject<Yeelight[]>([]);

connectedLights$
    .pipe(map(lights => lights.length), startWith(0), distinctUntilChanged())
    .subscribe(nbConnected => {
        console.log(`Number of Yeelight connected: ${nbConnected}`);
        // emitEvent(socket, 'ambient number connected', {id: deviceId, nbConnected});
    });

lookup$.subscribe(() => {
    console.log('lookup$ called');

    lookupReset$.next();
    look.init();

    look.on('detected', (light: Yeelight) => {
        console.log(`Yeelight detected: id=${light.id} name=${light.name}`);

        if (Object.keys(curLightState$.getValue()).indexOf(light.id) !== -1) {
            console.log(`Seems that Yeelight id=${light.id} is already connected`);
            return;
        }

        connectedLights$.next(look.pruneLights());
        blinkLight(light);

        const exited$ = new Subject<void>();

        lookupReset$.pipe(take(1)).subscribe(() => {
            console.log('lookupReset$ called, destroying');
            light.destroy();
        });

        // Yeelight events

        light.fromEvent('connected').subscribe(() => {
            console.log(`light connected: ${light.id}`);
            connectedLights$.next(look.pruneLights());
        });

        light.fromEvent('stateUpdate').subscribe(l => {
            const rgb = `R ${Math.round(l.rgb.r)}, G ${Math.round(l.rgb.g)}, B ${Math.round(l.rgb.b)}`;
            console.log(`light stateUpdate: ${light.id}: power ${l.power ? 'ON' : 'OFF'}, ${rgb}`);
            curLightState$.next({
                ...curLightState$.getValue(),
                [l.id]: l,
            });
        });

        light.fromEvent('failed').subscribe(err => {
            console.error(`light error: ${light.id}:`, err);
        });

        light.fromEvent('disconnected').subscribe(() => {
            console.log(`light disconnected: ${light.id}`);
            const oldState = curLightState$.getValue();
            curLightState$.next(
                Object.keys(oldState)
                    .filter(key => key !== light.id)
                    .reduce((obj, key) => ({...obj, [key]: oldState[key]}), {}),
            );
            connectedLights$.next(look.pruneLights());
            exited$.next();
            exited$.complete();
        });

        light.fromEvent('destroyed').pipe(take(1)).subscribe(() => {
            console.error(`Yeelight removed: ${light.id}`);
        });

        // From subjects

        setPower$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
            console.log(`Set power: ${JSON.stringify(data)}`);
            light.setPower(data.power, data.duration).then(onOperationSuccess).catch(onOperationFailed);
        });

        setRGB$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
            console.log(`Set RGB: ${JSON.stringify(data)}`);
            light.setRGB(data.rgb, data.duration).then(onOperationSuccess).catch(onOperationFailed);
        });

        setHSV$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
            console.log(`Set HSV: ${JSON.stringify(data)}`);
            light.setHSV(data.hsv, data.duration).then(onOperationSuccess).catch(onOperationFailed);
        });

        setCT$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
            console.log(`Set CT: ${JSON.stringify(data)}`);
            light.setCT(data.ct, data.duration).then(onOperationSuccess).catch(onOperationFailed);
        });

        setBright$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
            console.log(`Set bright: ${JSON.stringify(data)}`);
            light.setBright(data.bright, data.duration).then(onOperationSuccess).catch(onOperationFailed);
        });

        blink$.pipe(takeUntil(exited$)).subscribe(() => {
            blinkLight(light);
        });
    });
});
