import {of} from 'rxjs';
import {delay, tap} from 'rxjs/operators';
import {Yeelight} from './ts-yeelight-wifi/yeelight';

export function rgbToHex(r: number, g: number, b: number): string {
    const r1 = Math.round(r).toString(16);
    const g1 = Math.round(g).toString(16);
    const b1 = Math.round(b).toString(16);
    return `#${r1.length === 1 ? `0${r1}` : r1}${g1.length === 1 ? `0${g1}` : g1}${b1.length === 1 ? `0${b1}` : b1}`;
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
