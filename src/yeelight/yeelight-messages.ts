/**
 * power: boolean, true=On, false=Off
 * duration: transition duration in ms
 */
export interface LightSetPowerMessage {
    power: boolean;
    duration: number;
}

/**
 * RGB: array of 3 integers 0-255
 * duration: transition duration in ms
 */
export interface LightSetRgbMessage {
    rgb: [number, number, number];
    duration: number;
}

/**
 * HSV: array of 3 integers, hue: 0-359, sat: 0-100, value: 0-100
 * duration: transition duration in ms
 */
export interface LightSetHsvMessage {
    hsv: [number, number, number];
    duration: number;
}

/**
 * CT: Color temperature, integer between 1700 (towards orange) and 6500 (towards blue)
 * duration: transition duration in ms
 */
export interface LightSetCtMessage {
    ct: number;
    duration: number;
}

/**
 * Brightness: integer, 1-100
 * duration: transition duration in ms
 */
export interface LightSetBrightMessage {
    bright: number;
    duration: number;
}
