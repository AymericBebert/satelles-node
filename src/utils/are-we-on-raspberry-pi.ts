import fs from 'fs';

const PI_MODEL_NO = [
    'BCM2708',
    'BCM2709',
    'BCM2710',
    'BCM2835',   // Raspberry Pi 1 and Zero
    'BCM2836',   // Raspberry Pi 2
    'BCM2837',   // Raspberry Pi 3 (and later Raspberry Pi 2)
    'BCM2837B0', // Raspberry Pi 3B+ and 3A+
    'BCM2711',   // Raspberry Pi 4B
    'BCM2712',   // Raspberry Pi 5
];

export function areWeOnRaspberryPi(): boolean {
    let cpuInfo: string;
    try {
        cpuInfo = fs.readFileSync('/proc/cpuinfo', {encoding: 'utf8'});
    } catch (e) {
        // if this fails, this is probably not a pi
        return false;
    }

    const cpuInfoParsed = Object.fromEntries(cpuInfo
        .split('\n')
        .map(line => line.replace(/\t/g, ''))
        .filter(line => line.length > 0)
        .map<[string, string]>(line => line.split(':', 2) as [string, string]));

    if (cpuInfoParsed.Hardware && PI_MODEL_NO.includes(cpuInfoParsed.Hardware)) {
        return true;
    }
    if (cpuInfoParsed.Model && cpuInfoParsed.Model.includes('Raspberry Pi')) {
        return true;
    }
    return false;
}

// cpuInfo.split('\n').map(line => line.replace(/\t/g, '')).filter(line => line.length > 0).map(line => line.split(':')).map(pair => pair.map(entry => entry.trim())).filter(pair => pair[0] === 'Hardware');
