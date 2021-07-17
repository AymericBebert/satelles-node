import {exec} from 'child_process';

export function getVolume(): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
        exec('osascript -e \'get volume settings\'', (error, stdout) => {
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
    });
}

export function setVolume(volume: number): void {
    console.log('ACTION: setVolume ', volume);
    exec(`osascript -e 'set volume output volume ${volume} --100%'`);
}

export function sendToSleep(): void {
    console.log('ACTION: sendToSleep');
    exec('pmset sleepnow');
}
