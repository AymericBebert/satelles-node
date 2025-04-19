import {areWeOnRaspberryPi} from './are-we-on-raspberry-pi';

export class GpioMock {
    constructor(
        private pin: number,
        options?: {
            mode?: number;
            pullUpDown?: number;
            edge?: number;
            timeout?: number;
            alert?: boolean;
        }
    ) {
        console.log(`[MOCK GPIO ${this.pin}] initialized with options`, options);
    }

    mode(mode: number): GpioMock {
        console.log(`[MOCK GPIO ${this.pin}] mode to ${mode}`);
        return this;
    }

    digitalRead(): number {
        console.log(`[MOCK GPIO ${this.pin}] digitalRead`);
        return 0;
    }

    digitalWrite(level: number): GpioMock {
        console.log(`[MOCK GPIO ${this.pin}] digitalWrite to ${level}`);
        return this;
    }

    /* mode */
    static INPUT = 0;
    static OUTPUT = 1;
    static ALT0 = 4;
    static ALT1 = 5;
    static ALT2 = 6;
    static ALT3 = 7;
    static ALT4 = 3;
    static ALT5 = 2;

    /* pull up/down resistors */
    static PUD_OFF = 0;
    static PUD_DOWN = 1;
    static PUD_UP = 2;

    /* isr */
    static RISING_EDGE = 0;
    static FALLING_EDGE = 1;
    static EITHER_EDGE = 2;

    /* timeout */
    static TIMEOUT = 2;

    /* gpio numbers */
    static MIN_GPIO = 0;
    static MAX_GPIO = 53;
    static MAX_USER_GPIO = 31;
}

let GpioClass = GpioMock;

if (areWeOnRaspberryPi()) {
    console.warn('Raspberry Pi detected, we will use pigpio library');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-var-requires
    const pigpio = require('pigpio');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    GpioClass = pigpio.Gpio;
} else {
    console.warn('Not running on Raspberry Pi, using GpioMock');
}

export const GpioOrMock = GpioClass;
