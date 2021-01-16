import {exec} from 'child_process';
import {ICommand} from './model/satelles';

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
        name: '_macos_controls',
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
