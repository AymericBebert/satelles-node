import {of} from 'rxjs';
import {delay, tap} from 'rxjs/operators';
import {Yeelight} from './ts-yeelight-wifi/yeelight';

function yeelightState(yl: Yeelight): {
    id: string,
    power: boolean,
    bright: number,
    rgb: { r: number, g: number, b: number },
} {
    return {
        id: yl.id,
        power: yl.power,
        bright: yl.bright,
        rgb: yl.rgb,
    };
}

function ylStatesHash(s: { [id: string]: Yeelight }): string {
    return JSON.stringify(Object.values(s).map(y => yeelightState(y)));
}

export function yeelightStatesComparison(s0: { [id: string]: Yeelight }, s1: { [id: string]: Yeelight }): boolean {
    return ylStatesHash(s0) === ylStatesHash(s1);
}

export function onOperationSuccess(): void {
    // console.log('success');
}

export function onOperationFailed(error: string): void {
    console.log(`failed: ${error}`);
}

export function valueNotNull<T>(value: null | undefined | T): value is T {
    return value !== null && value !== undefined;
}

export function blinkLight(light: Yeelight): void {
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
