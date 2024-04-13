import pigpio, {GenericWaveStep} from 'pigpio';
import {Pulses} from './pulsefiles/pulse';

function addPulse(outPin: number, period: number, waveform: GenericWaveStep[]): void {
    const nbPulses = Math.floor(period / 13);
    for (let x = 0; x < nbPulses; x++) {
        if (x % 2 === 0) {
            waveform.push({gpioOn: outPin, gpioOff: 0, usDelay: 13});
        } else {
            waveform.push({gpioOn: 0, gpioOff: outPin, usDelay: 13});
        }
    }
    if (nbPulses % 2 === 0) {
        waveform.push({gpioOn: outPin, gpioOff: 0, usDelay: period - nbPulses * 13});
    } else {
        waveform.push({gpioOn: 0, gpioOff: outPin, usDelay: period - nbPulses * 13});
    }
}

function addSpace(outPin: number, period: number, waveform: GenericWaveStep[]): void {
    waveform.push({gpioOn: 0, gpioOff: outPin, usDelay: period});
}

function sendWaveform(waveform: GenericWaveStep[], timeTarget = 0): number {
    pigpio.waveAddGeneric(waveform);
    const waveId = pigpio.waveCreate();
    if (waveId >= 0) {
        if (timeTarget > 0) {
            let loops = 0;
            while (performance.now() < timeTarget) {
                loops++;
            }
            pigpio.waveTxSend(waveId, pigpio.WAVE_MODE_ONE_SHOT);
        } else {
            pigpio.waveTxSend(waveId, pigpio.WAVE_MODE_ONE_SHOT);
        }
    } else {
        return -1;
    }
    while (pigpio.waveTxBusy()) {
        /* empty */
    }
    const finishedAt = performance.now();
    pigpio.waveDelete(waveId);
    return finishedAt;
}

export function sendPulses(outPin: number, pulses: Pulses): void {
    const waveforms: GenericWaveStep[][] = [];
    let waveform: GenericWaveStep[] = [];
    for (const pulse of pulses) {
        if (pulse.action === 'space' && pulse.duration > 50000) {
            waveforms.push(waveform);
            waveform = [];
        } else if (pulse.action === 'pulse') {
            addPulse(outPin, pulse.duration, waveform);
        } else if (pulse.action === 'space') {
            addSpace(outPin, pulse.duration, waveform);
        }
    }
    waveforms.push(waveform);

    let previousFinished = sendWaveform(waveforms[0]);
    for (const w of waveforms.slice(1)) {
        previousFinished = sendWaveform(w, previousFinished + 61.200);
    }
}
