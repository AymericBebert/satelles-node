import Color from 'color';
import {EventEmitter} from 'events';
import net from 'net';
import {SsdpHeaders} from 'node-ssdp';
import {fromEvent, Observable} from 'rxjs';
import {temp2rgb} from './color-temp';

const REQUEST_TIMEOUT = 5000;
const HEARTBEAT_INTERVAL = 10000;
const SOCKET_TIMEOUT = 32000;

// specs: http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf

interface YeelightMessage {
    id: number;
    method: string;
    params: (string | number)[];
    timeout: NodeJS.Timeout;
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
}

interface YeelightState {
    hsb: { h: number; s: number; b: number };
    bright: number;
    power: boolean;
    type: 'unknown' | 'white' | 'color';
    rgb: { r: number; g: number; b: number }
}

interface YeelightSsdpData {
    ID: string;
    NAME: string;
    MODEL: string;
    FW_VER: string;
    SUPPORT: string;
    LOCATION: string;
    POWER: 'on';
}

type YeelightSsdpMessage = SsdpHeaders | YeelightSsdpData;

interface YeelightColorMessage {
    COLOR_MODE: string;
    RGB: string;
    CT: string;
    HUE: string;
    SAT: string;
    BRIGHT: string;
}

interface YeelightEventTypes {
    'connect': undefined;
    'connected': undefined;
    'failed': { reason: string, response: any };
    'disconnected': undefined;
    'destroyed': undefined;
    'stateUpdate': Yeelight;
    'update': { response: any };
    'success': { id: number, method: string, params: (string | number)[], response: any };
    'timeout': { id: number, method: string, params: (string | number)[] };
}

interface YeelightResponse {
    id?: number;
    result?: string[];
    method?: string;
    params?: {
        name?: string;
        power?: string;
        bright?: number;
        color_mode?: number;
        rgb?: number;
        hue?: number;
        sat?: number;
        ct?: number;
    };
    error?: {
        code: number;
        message: string;
    };
}

export class Yeelight extends EventEmitter {
    // network
    public id = '';
    public host = '';
    public mac = ''; // existence of this value not guaranteed (if the light is not in the same net)
    public name = '';

    // color values
    public power = false;
    public bright = 0;
    public rgb: { r: number, g: number, b: number } = {r: 0, g: 0, b: 0};
    public hsb: { h: number, s: number, b: number } = {h: 0, s: 0, b: 0};

    // network
    private connected = false;
    private socket: net.Socket | null = null;
    private port = 0;

    // messages object
    private messageId = 1;
    private messages: { [id: number]: YeelightMessage } = {};

    private type: 'unknown' | 'white' | 'color' = 'unknown';

    private model = '';
    private firmware = '';
    private support = '';

    private heartBeat: NodeJS.Timeout | null = null;
    private lastAnswer: number = Date.now();

    constructor(ssdpMessage?: YeelightSsdpMessage) {
        super();
        if (ssdpMessage) {
            this.updateBySSDPMessage(ssdpMessage);
            this.connect();
        }
    }

    public getState(): YeelightState {
        return {
            type: this.type,
            power: this.power,
            bright: this.bright,
            rgb: this.rgb,
            hsb: this.hsb,
        };
    }

    public init(host: string, port: number, mac: string): void {
        console.log(`Yeelight init with host ${host}, port ${port}, mac ${mac}`);

        this.mac = mac;
        this.host = host;
        this.port = port;

        // connect and get initial data
        this.connect();
        this.updateState()
            .then(() => console.log('updateState ok'))
            .catch(error => console.log(`updateState error: ${error as string}`));
    }

    public updateBySSDPMessage(ssdpMessage: YeelightSsdpMessage): void {
        this.id = ssdpMessage.ID as string;
        this.name = ssdpMessage.NAME as string || '';

        this.model = ssdpMessage.MODEL as string;
        this.firmware = ssdpMessage.FW_VER as string;
        this.support = ssdpMessage.SUPPORT as string;

        // get hostname and port
        const location = ssdpMessage.LOCATION || '';
        const regex = /\/\/(.*):(.*)/g;
        const matches = regex.exec(location);

        if (matches && matches.length >= 3) {
            this.host = matches[1];
            this.port = parseInt(matches[2], 10);
        }

        // detect type
        if (this.support) {
            const supported = this.support.split(' ');

            if (supported.indexOf('set_ct_abx') !== -1) {
                this.type = 'white';
            }
            if (supported.indexOf('set_rgb') !== -1 || supported.indexOf('set_hsv') !== -1) {
                this.type = 'color';
            }
        }

        this.power = ssdpMessage.POWER === 'on';
        this.updateColorBySSDPMessage(ssdpMessage as unknown as YeelightColorMessage);
    }

    public connect(): void {
        if (this.socket) {
            this.disconnect();
        }

        this.emitTyped('connect');

        this.socket = new net.Socket();
        this.lastAnswer = Date.now();

        this.heartBeat = setInterval(() => {
            if (this.socket) {
                this.socket.write('{"id":-1,"method":"get_prop","params":["power"]}\r\n');
                if (this.lastAnswer < Date.now() - SOCKET_TIMEOUT) {
                    console.log('Yeelight timeout');
                    this.disconnect();
                }
            }
        }, HEARTBEAT_INTERVAL);

        // data response
        this.socket.on('data', (data: any) => {
            this.lastAnswer = Date.now();
            this.parseResponse.bind(this)(data);
        });

        this.socket.on('end', (data: any) => {
            this.parseResponse.bind(data);
            this.disconnect();
        });

        this.socket.connect(this.port, this.host, () => {
            this.emitTyped('connected');
            this.connected = true;
        });

        this.socket.on('close', () => {
            this.disconnect();
        });

        this.socket.on('error', (err) => {
            this.emitTyped('failed', {reason: 'socket error', response: err});
            // close event will be called afterwards
        });
    }

    public disconnect(): void {
        if (!this.socket && !this.connected && !this.heartBeat) {
            return;
        }

        if (this.socket) {
            try {
                this.socket.destroy();
            } catch (e) {
                console.warn('Could not disconnect');
            }
        }

        this.socket = null;
        this.connected = false;

        if (this.heartBeat) {
            clearInterval(this.heartBeat);
            this.heartBeat = null;
        }

        this.emitTyped('disconnected');
    }

    public isConnected(): boolean {
        return (!!this.socket && this.connected);
    }

    public destroy(): void {
        this.disconnect();
        this.emitTyped('destroyed');
        this.removeAllListeners();
    }

    public setRGB(rgb: [number, number, number], duration?: number): Promise<unknown> {
        const nb = Color.rgb(rgb).rgbNumber();

        // update local state
        this.updateByRGB(nb.toString(10));

        // "rgb_value", "effect", "duration"
        const params =
            [
                nb,
                (duration) ? 'smooth' : 'sudden',
                (duration) ? duration : 0,
            ];

        return this.sendCommand('set_rgb', params);
    }

    public setBright(bright: number, duration?: number): Promise<unknown> {
        // update local state
        this.updateBright(bright.toString(10));

        // "brightness", "effect", "duration"
        const params =
            [
                bright,
                (duration) ? 'smooth' : 'sudden',
                (duration) ? duration : 0,
            ];

        return this.sendCommand('set_bright', params);
    }

    public setHSV(hsv: [number, number, number], duration?: number): Promise<unknown> {
        const color = Color.hsv(hsv);

        const hue = color.hue();
        const sat = color.saturationv();
        const bright = color.value();

        // update local state
        this.updateHSV(hue.toString(10), sat.toString(10), bright.toString(10));

        // "hue", "sat", "effect", "duration"
        const params =
            [
                hue,
                sat,
                (duration) ? 'smooth' : 'sudden',
                (duration) ? duration : 0,
            ];

        const proms = [];

        proms.push(this.sendCommand('set_hsv', params));

        // set bright/value
        proms.push(this.setBright(bright, duration));

        return Promise.all(proms);
    }

    // ct: 1700 ~ 6500
    public setCT(ct: number, duration?: number): Promise<unknown> {
        // update local state
        this.updateCT(ct.toString());

        // "ct_value", "effect", "duration"
        const params =
            [
                ct,
                (duration) ? 'smooth' : 'sudden',
                (duration) ? duration : 0,
            ];

        return this.sendCommand('set_ct_abx', params);
    }

    public setPower(power: boolean, duration?: number): Promise<unknown> {
        // update local state
        this.updatePower(power.toString());

        // "power", "effect", "duration"
        const params =
            [
                this.power ? 'on' : 'off',
                (duration) ? 'smooth' : 'sudden',
                (duration) ? duration : 0,
            ];

        return this.sendCommand('set_power', params);
    }

    public fromEvent<T extends keyof YeelightEventTypes>(eventName: T): Observable<YeelightEventTypes[T]> {
        return fromEvent(this as any, eventName);
        // .pipe(tap(data => console.log(`yeelight> ${eventName}:`, data)));
    }

    private emitTyped<T extends keyof YeelightEventTypes>(eventName: T, ...data: Array<YeelightEventTypes[T]>) {
        // console.log(`yeelight< ${eventName}:`, ...data);
        return this.emit(eventName, ...data);
    }

    private updateState(): Promise<unknown> {
        return this.sendCommand('get_prop', ['power', 'color_mode', 'ct', 'rgb', 'hue', 'sat', 'bright']);
    }

    private updateColorBySSDPMessage(ssdpMessage: YeelightColorMessage): void {
        // 1 means color mode, 2 means color temperature mode, 3 means HSV mode.
        const colorMode = parseInt(ssdpMessage.COLOR_MODE, 10);

        // value from rgb
        if (colorMode === 1) {
            this.updateByRGB(ssdpMessage.RGB, ssdpMessage.BRIGHT);
        } else if (colorMode === 2) {
            this.updateCT(ssdpMessage.CT, ssdpMessage.BRIGHT);
        } else if (colorMode === 3) {
            this.updateHSV(ssdpMessage.HUE, ssdpMessage.SAT, ssdpMessage.BRIGHT);
        }
    }

    private updateColor(rgbColor: Color<number>, bright?: string): void {
        const hsv = rgbColor.hsv();

        this.rgb.r = rgbColor.red();
        this.rgb.g = rgbColor.green();
        this.rgb.b = rgbColor.blue();

        if (typeof bright !== 'undefined' && bright !== '') {
            this.bright = parseInt(bright, 10);
        }

        this.hsb.h = hsv.hue();
        this.hsb.s = hsv.saturationv();  // or l ?
        this.hsb.b = this.bright;

        // console.log('updateColor => new rgb: ', this.rgb);
        this.emitTyped('stateUpdate', this);
    }

    private updateByRGB(rgb: string, bright?: string): void {
        // rgb values: 0 to 16777215
        this.updateColor(Color(parseInt(rgb, 10)), bright);
    }

    private updateCT(ct: string, bright?: string): void {
        // ct values: 1700 to 6500
        const rgb = temp2rgb(parseInt(ct, 10));
        this.updateColor(Color.rgb(rgb), bright);
    }

    private updateHSV(hue: string, sat: string, val?: string): void {
        if (typeof val !== 'undefined' && val !== '') {
            this.bright = parseInt(val, 10);
        }

        this.hsb.h = parseInt(hue, 10);
        this.hsb.s = parseInt(sat, 10);
        this.hsb.b = this.bright;

        const rgb = Color.hsv([this.hsb.h, this.hsb.s, this.hsb.b]).rgb();

        this.rgb.r = rgb.red();
        this.rgb.g = rgb.green();
        this.rgb.b = rgb.blue();

        // console.log('updateByRGB => new rgb: ', this.rgb);
        this.emitTyped('stateUpdate', this);
    }

    private updateBright(bright: string): void {
        this.bright = parseInt(bright, 10);
        this.hsb.b = this.bright;

        // console.log('updateBright => new rgb: ', this.rgb);
        this.emitTyped('stateUpdate', this);
    }

    private updatePower(power: string): void {
        this.power = (power && ('' + power).toLowerCase() !== 'off'
            && ('' + power).toLowerCase() !== 'false' && power !== '0') || false;

        this.emitTyped('stateUpdate', this);
    }

    private parseResponse(res: Record<string, unknown>): void {
        // console.log(`parseResponse (${typeof res}): ${JSON.stringify(res)}`);
        const responses: string = res.toString();

        // sometimes there are multiple messages in one message
        const splits = responses.split('\r\n');

        splits.forEach(response => {
            if (!response) {
                return;
            }

            let json: YeelightResponse = {};
            try {
                // console.log(`parseResponse: ${response}`);
                json = JSON.parse(response) as YeelightResponse;
            } catch (e) {
                console.error(e);
                console.log(response);
                this.emitTyped('failed', {reason: 'response is not parsable', response});
                return;
            }

            const id = json.id;
            const method = json.method;
            const params = json.params || {};
            const result = json.result || [];
            if (method === 'props') {
                if (params.power) {
                    this.updatePower(params.power);
                }

                if (params.rgb) {
                    this.updateByRGB(params.rgb.toString(10));
                }

                if (params.bright) {
                    this.updateBright(params.bright.toString(10));
                }

                if (params.ct) {
                    this.updateCT(params.ct.toString(10));
                }

                if (params.hue && params.sat) {
                    this.updateHSV(params.hue.toString(10), params.sat.toString(10));
                }

                if (params.name) {
                    this.name = params.name;
                }

                this.emitTyped('update', {response: json});
            }
            if (result && id && this.messages[id] && this.messages[id].method === 'get_prop') {
                const mParams = this.messages[id].params;
                const values = result;

                if (mParams.length === values.length) {
                    // generate object out of mParams and result-values
                    const obj: { [key: string]: any } = {};
                    for (let i = 0; i < mParams.length; ++i) {
                        const key = mParams[i];
                        obj[key] = values[i];
                    }

                    // detect type (if Yeelight instance was created by host and port only - without ssdp)
                    // if the result of rgb is "" --> this means that rgb value is not supported
                    // (otherwise it will be "0" -> "16777215")
                    if (obj.rgb === '') {
                        this.type = 'white';
                    } else {
                        this.type = 'color';
                    }

                    if ('power' in obj) {
                        this.updatePower(obj.power);
                    }

                    if ('color_mode' in obj) {
                        if (obj.color_mode === '1' && 'rgb' in obj) {
                            this.updateByRGB(obj.rgb, obj.bright);
                        } else if (obj.color_mode === '2' && 'ct' in obj) {
                            this.updateCT(obj.ct, obj.bright);
                        } else if (obj.color_mode === '3' && 'hue' in obj && 'sat' in obj) {
                            this.updateHSV(obj.hue, obj.sat, obj.bright);
                        }
                    } else {
                        if ('bright' in obj) {
                            this.updateBright(obj.bright);
                        }
                    }
                } else {
                    this.emitTyped('failed', {
                        reason: 'error on parsing get_prop result --> mParams length != values length',
                        response,
                    });
                    console.error('error on parsing get_prop result --> mParams length != values length');
                    console.log(mParams);
                    console.log(values);
                }
            }
            if (id && this.messages[id]) {
                const msg = this.messages[id];

                clearTimeout(msg.timeout);

                this.emitTyped('success', {
                    id: msg.id,
                    method: msg.method,
                    params: msg.params,
                    response: json,
                });

                const resolve = msg.resolve;

                delete this.messages[id];

                // resolve on the end
                resolve(this);
            }
        });
    }

    private sendCommand(method: string, params: (string | number)[]): Promise<unknown> {
        // connect if not connected
        if (!this.isConnected()) {
            this.connect();
        }

        // check message
        let supportedMethods: string[] = [];
        if (this.support) {
            supportedMethods = this.support.split(' ');
        }

        const id = this.messageId;
        ++this.messageId;

        // check if method is allowed - its also allowed if there is no support set
        // (if light is added via hostname and port and not via ssdp)
        if ((this.support === '' || supportedMethods.indexOf(method) !== -1) && params && params.length > 0) {
            const paramsStr = JSON.stringify(params);

            const str = `{"id":${id},"method":"${method}","params":${paramsStr}}\r\n`;

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    const msg = this.messages[id];
                    this.emitTyped('timeout', {
                        id: msg.id,
                        method: msg.method,
                        params: msg.params,
                    });

                    delete this.messages[id];
                    reject(`id: ${id} timeout`);

                }, REQUEST_TIMEOUT);

                // append message
                this.messages[id] = {id, method, params, timeout, resolve, reject};

                if (this.socket) {
                    // console.log(`Writing '${str.trim()}' in socket`);
                    this.socket.write(str);
                } else {
                    console.log(`No socket to write ${str}`);
                }
            });
        } else {
            return Promise.reject('method is not supported or empty params are set');
        }
    }
}
