import fs from 'fs'
import {BehaviorSubject, interval, of, Subject} from 'rxjs';
import {delay, distinctUntilChanged, filter, map, startWith, switchMap, take, takeUntil, tap} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';
import {load} from 'js-yaml';
import {RerumNodeConfig} from './config';
import {emitEvent, fromEventTyped} from './events';
import {getVolume, MACOS_CONTROLS_NAME, setVolume, volumeCommand} from './commands/macos-volume';
import {yeelightCommands} from './commands/yeelight';
import {
    LightSetBrightMessage,
    LightSetCtMessage,
    LightSetHsvMessage,
    LightSetPowerMessage,
    LightSetRgbMessage
} from './model/light-messages';
import {Lookup} from './ts-yeelight-wifi/lookup';
import {Yeelight} from './ts-yeelight-wifi/yeelight';
import {configuration, version} from './version';

console.log(`Starting satelles-node version ${version}, configuration ${configuration}...`)

// Ugly config load
const config = load(fs.readFileSync(`${__dirname}/../config.yml`, 'utf8')) as RerumNodeConfig;

// Get config from env
const serverUrl = process.env.SERVER_URL || config.hub.serverUrl;
const roomToken = process.env.ROOM_TOKEN || config.hub.roomToken;
const roomName = process.env.ROOM_NAME || config.hub.roomName;
const deviceId = process.env.DEVICE_ID || config.hub.deviceId;
const deviceName = process.env.DEVICE_NAME || config.hub.deviceName;

console.log(`Connecting to ${serverUrl}...`)
const socket: Socket = io(serverUrl);

const connected$ = new Subject<void>();

fromEventTyped(socket, 'connect').subscribe(() => {
    console.log(`Connected to socket at ${serverUrl}`)

    connected$.next();

    let curVolume = 0;

    emitEvent(socket, 'satelles join', {
        token: roomToken,
        roomName: roomName,
        satelles: {
            id: deviceId,
            name: deviceName,
            commands: [
                ...(config.commands.indexOf('macos') > -1 ? [volumeCommand(0)] : []),
                ...(config.commands.indexOf('yeelight') > -1 ? yeelightCommands() : []),
            ],
        },
    });

    if (config.commands.indexOf('macos') > -1) {
        interval(10000)
            .pipe(switchMap(() => getVolume()), takeUntil(connected$))
            .subscribe(cv => {
                if (cv !== null && cv !== curVolume) {
                    curVolume = cv;
                    emitEvent(socket, 'satelles update', [
                        ...(config.commands.indexOf('macos') > -1 ? [volumeCommand(cv)] : []),
                        ...(config.commands.indexOf('yeelight') > -1 ? yeelightCommands() : []),
                    ]);
                }
            });
    }

    if (config.commands.indexOf('yeelight') > -1) {
        lookup$.next();
    }
});

fromEventTyped(socket, 'imperium action').subscribe(action => {
    if (action.commandName == MACOS_CONTROLS_NAME) {
        (action.args || []).forEach(arg => {
            if (arg.name == 'Volume') {
                setVolume(arg?.numberValue ?? 10);
            }
        })
    }

    if (action.commandName == 'YL Blink') {
        blink$.next();
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
            // const rgb = `R ${Math.round(l.rgb.r)}, G ${Math.round(l.rgb.g)}, B ${Math.round(l.rgb.b)}`;
            // console.log(`light stateUpdate: ${light.id}: power ${l.power}, ${rgb}`);
        });

        light.fromEvent('failed').subscribe(err => {
            console.error(`light error: ${light.id}:`, err);
        });

        light.fromEvent('disconnected').subscribe(() => {
            // console.log(`light disconnected: ${light.id}`);
            connectedLights$.next(look.pruneLights());
        });

        light.fromEvent('destroyed').pipe(take(1)).subscribe(() => {
            console.error(`Yeelight removed: ${light.id}`);
            exited$.next();
            exited$.complete();
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
