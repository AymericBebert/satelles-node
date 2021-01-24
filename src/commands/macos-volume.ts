import {exec} from 'child_process';
import {ICommand} from '../model/satelles';

export const MACOS_CONTROLS_NAME = 'macOS Controls';

export function getVolume(): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
        exec('osascript -e \'get volume settings\'', (error, stdout,) => {
            if (!error) {
                const volMatch = /output volume:(\d+),/.exec(stdout)?.[1];
                if (volMatch) {
                    resolve(parseInt(volMatch, 10));
                } else {
                    reject('No match');
                }
            } else {
                reject(error);
            }
        });
    })
}

export function setVolume(volume: number): void {
    exec(`osascript -e 'set volume output volume ${volume} --100%'`)
}

export function volumeCommand(curVolume: number): ICommand {
    return {
        name: MACOS_CONTROLS_NAME,
        type: 'complex',
        args: [
            {
                name: 'Volume',
                type: 'number',
                numberValue: curVolume,
                numberMin: 0,
                numberMax: 100,
                numberStep: 1,
            },
        ],
    };
}
