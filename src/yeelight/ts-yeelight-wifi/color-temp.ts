export function temp2rgb(t: number): [number, number, number] {
    const t100 = t / 100;
    const rgb: [number, number, number] = [0, 0, 0];
    if (t <= 6504) {
        rgb[0] = 255;
        rgb[1] = t100;
        rgb[1] = 99.4708025861 * Math.log(rgb[1]) - 161.1195681661;
        if (rgb[1] < 0) {
            rgb[1] = 0;
        }
        if (rgb[1] > 255) {
            rgb[1] = 255;
        }
    } else {
        rgb[0] = t100 - 60;
        rgb[0] = 329.698727446 * Math.pow(rgb[0], -0.1332047592);
        if (rgb[0] < 0) {
            rgb[0] = 0;
        }
        if (rgb[0] > 255) {
            rgb[0] = 255;
        }
        rgb[1] = t100 - 60;
        rgb[1] = 288.1221695283 * Math.pow(rgb[1], -0.0755148492);
        if (rgb[1] < 0) {
            rgb[1] = 0;
        }
        if (rgb[1] > 255) {
            rgb[1] = 255;
        }
    }
    if (t >= 6504) {
        rgb[2] = 255;
    } else {
        if (t100 <= 19) {
            rgb[2] = 0;
        } else {
            rgb[2] = t100 - 10;
            rgb[2] = 138.5177312231 * Math.log(rgb[2]) - 305.0447927307;
            if (rgb[2] < 0) {
                rgb[2] = 0;
            }
            if (rgb[2] > 255) {
                rgb[2] = 255;
            }
        }
    }
    return rgb;
}

export function rgb2temp(r: number, g: number, b: number): number {
    let tMin = 1000;
    let tMax = 40000;
    let t = 0;
    let testRgb = [0, 0, 0];
    while (tMax - tMin > 0.4) {
        t = (tMax + tMin) / 2;
        testRgb = temp2rgb(t);
        if ((testRgb[2] / testRgb[0]) >= (b / r)) {
            tMax = t;
        } else {
            tMin = t;
        }
    }
    return Math.round(t);
}

export function rgb2hex(r: number, g: number, b: number) {
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

export function hex2rgb(hex: string): [number, number, number] {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m: string, r: string, g: string, b: string) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
}
