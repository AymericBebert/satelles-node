import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {distinctUntilChanged, filter, map, startWith, take, takeUntil} from 'rxjs/operators';
import {CommandRunner} from '../model/command-runner';
import {IImperiumAction} from '../model/imperium';
import {ICommand} from '../model/satelles';
import {hex2rgb, rgb2hex, rgb2temp} from './ts-yeelight-wifi/color-temp';
import {Lookup} from './ts-yeelight-wifi/lookup';
import {Yeelight} from './ts-yeelight-wifi/yeelight';
import {
    LightSetBrightMessage,
    LightSetCtMessage,
    LightSetHsvMessage,
    LightSetPowerMessage,
    LightSetRgbMessage,
} from './yeelight-messages';
import {blinkLight, onOperationFailed, onOperationSuccess, rgbToHex, valueNotNull} from './yeelight-utils';

export class YeelightCommandRunner implements CommandRunner {
    private sendCommandUpdate$ = new Subject<void>();
    private disconnected$ = new Subject<void>();
    private destroy$ = new Subject<void>();

    private setPower$ = new BehaviorSubject<LightSetPowerMessage | null>(null);
    private setRGB$ = new BehaviorSubject<LightSetRgbMessage | null>(null);
    private setHSV$ = new BehaviorSubject<LightSetHsvMessage | null>(null);
    private setCT$ = new BehaviorSubject<LightSetCtMessage | null>(null);
    private setBright$ = new BehaviorSubject<LightSetBrightMessage | null>(null);
    private blink$ = new Subject<void>();

    private lookup$ = new Subject<void>();
    private lookupReset$ = new Subject<void>();

    private curLightState$ = new BehaviorSubject<{ [id: string]: Yeelight }>({});

    public get name(): string {
        return 'yeelight';
    }

    public get commandsUpdate$(): Observable<ICommand[]> {
        return this.sendCommandUpdate$.pipe(
            startWith(void 0),
            map(() => this.commands),
            takeUntil(this.destroy$),
        );
    }

    public get commands(): ICommand[] {
        const yl = Object.values(this.curLightState$.getValue())[0] || null;
        if (yl === null) {
            return [];
        }
        const powerCommand: ICommand[] = yl.power ? [{
            name: 'YL Turn Off',
            type: 'action',
        }] : [{
            name: 'YL Turn On',
            type: 'action',
        }];
        return [
            ...powerCommand,
            {
                name: 'YL Blink',
                type: 'action',
            },
            {
                name: 'YL Control',
                type: 'complex',
                args: [
                    {
                        name: 'Brightness',
                        type: 'number',
                        numberValue: yl.bright,
                        numberMin: 1,
                        numberMax: 100,
                        numberStep: 1,
                    },
                    {
                        name: 'Temperature',
                        type: 'number',
                        numberValue: rgb2temp(yl.rgb.r, yl.rgb.g, yl.rgb.b),
                        numberMin: 1700,
                        numberMax: 6500,
                        numberStep: 100,
                    },
                    {
                        name: 'Color',
                        type: 'color',
                        colorValue: rgb2hex(yl.rgb.r, yl.rgb.g, yl.rgb.b),
                    },
                ],
            },
        ];
    }

    public init(): void {
        this.destroy$.next();

        // Communication with lights

        const look: Lookup = new Lookup(20 * 1000, false);

        const connectedLights$ = new BehaviorSubject<Yeelight[]>([]);

        connectedLights$
            .pipe(
                map(lights => lights.length),
                startWith(0),
                distinctUntilChanged(),
                takeUntil(this.destroy$),
            )
            .subscribe(nbConnected => {
                console.log(`Number of Yeelight connected: ${nbConnected}`);
            });

        this.lookup$
            .pipe(
                takeUntil(this.destroy$),
            )
            .subscribe(() => {
                console.log('lookup$ called');

                this.lookupReset$.next();
                look.init();

                look.on('detected', (light: Yeelight) => {
                    console.log(`Yeelight detected: id=${light.id} name=${light.name}`);

                    if (Object.keys(this.curLightState$.getValue()).indexOf(light.id) !== -1) {
                        console.log(`Seems that Yeelight id=${light.id} is already connected`);
                        return;
                    }

                    connectedLights$.next(look.pruneLights());
                    blinkLight(light);

                    const exited$ = new Subject<void>();

                    this.lookupReset$.pipe(take(1)).subscribe(() => {
                        console.log('lookupReset$ called, destroying');
                        light.destroy();
                    });

                    // Yeelight events

                    light.fromEvent('connected').subscribe(() => {
                        console.log(`light connected: ${light.id}`);
                        connectedLights$.next(look.pruneLights());
                    });

                    light.fromEvent('stateUpdate').subscribe(l => {
                        const rgb = rgbToHex(l.rgb.r, l.rgb.g, l.rgb.b);
                        const power = l.power ? 'ON' : 'OFF';
                        console.log(`light stateUpdate: ${light.id}: power ${power}, bright ${l.bright}, color ${rgb}`);
                        this.curLightState$.next({
                            ...this.curLightState$.getValue(),
                            [l.id]: l,
                        });
                    });

                    light.fromEvent('failed').subscribe(err => {
                        console.error(`light error: ${light.id}:`, err);
                    });

                    light.fromEvent('disconnected').subscribe(() => {
                        console.log(`light disconnected: ${light.id}`);
                        const oldState = this.curLightState$.getValue();
                        this.curLightState$.next(
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

                    this.setPower$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
                        console.log(`Set power: ${JSON.stringify(data)}`);
                        light.setPower(data.power, data.duration).then(onOperationSuccess).catch(onOperationFailed);
                    });

                    this.setRGB$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
                        console.log(`Set RGB: ${JSON.stringify(data)}`);
                        light.setRGB(data.rgb, data.duration).then(onOperationSuccess).catch(onOperationFailed);
                    });

                    this.setHSV$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
                        console.log(`Set HSV: ${JSON.stringify(data)}`);
                        light.setHSV(data.hsv, data.duration).then(onOperationSuccess).catch(onOperationFailed);
                    });

                    this.setCT$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
                        console.log(`Set CT: ${JSON.stringify(data)}`);
                        light.setCT(data.ct, data.duration).then(onOperationSuccess).catch(onOperationFailed);
                    });

                    this.setBright$.pipe(filter(valueNotNull), takeUntil(exited$)).subscribe(data => {
                        console.log(`Set bright: ${JSON.stringify(data)}`);
                        light.setBright(data.bright, data.duration).then(onOperationSuccess).catch(onOperationFailed);
                    });

                    this.blink$.pipe(takeUntil(exited$)).subscribe(() => {
                        blinkLight(light);
                    });
                });
            });
    }

    public connect(): void {
        this.lookup$.next();

        this.curLightState$
            .pipe(takeUntil(this.disconnected$))
            .subscribe(cls => {
                if (Object.keys(cls).length === 0) {
                    console.log('YL States is empty');
                    return;
                }
                console.log(`YL States of the ${Object.keys(cls).length} entries:`);
                Object.keys(cls).forEach(k => {
                    const l = cls[k];
                    const power = l.power ? 'ON' : 'OFF';
                    const rgb = rgbToHex(l.rgb.r, l.rgb.g, l.rgb.b);
                    console.log(`* YL State of ${k}: power ${power}, bright ${l.bright}, color ${rgb}`);
                });

                this.sendCommandUpdate$.next();
            });
    }

    public disconnect(): void {
        this.disconnected$.next();
    }

    public onAction(action: IImperiumAction): void {
        switch (action.commandName) {
            case 'YL Turn On':
                this.setPower$.next({power: true, duration: 200});
                break;

            case 'YL Turn Off':
                this.setPower$.next({power: false, duration: 200});
                break;

            case 'YL Blink':
                this.blink$.next();
                break;

            case 'YL Control':
                (action.args || []).forEach(arg => {
                    console.log('arg:', arg);
                    if (arg.name == 'Brightness' && arg.numberValue) {
                        this.setBright$.next({bright: arg.numberValue, duration: 200});
                    }
                    if (arg.name == 'Temperature' && arg.numberValue) {
                        this.setCT$.next({ct: arg.numberValue, duration: 200});
                    }
                    if (arg.name == 'Color' && arg.colorValue) {
                        this.setRGB$.next({rgb: hex2rgb(arg.colorValue), duration: 200});
                    }
                });
                break;
        }
    }
}
