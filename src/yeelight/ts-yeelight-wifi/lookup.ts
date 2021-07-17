import {EventEmitter} from 'events';
import arp from 'node-arp';
import ssdp, {SsdpHeaders} from 'node-ssdp';
import {Yeelight} from './yeelight';

// const PORT_SCAN_TIMEOUT = 10000;
// const SEARCH_INTERVAL = 10000;

const YEELIGHT_SSDP_PORT = 1982;
// const YEELIGHT_PORT = 55443;

// specs: http://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf

export class Lookup extends EventEmitter {
    private readonly lookupInterval: number;

    private lights: Yeelight[] = [];
    private ssdp: ssdp.Client | null = null;
    private interval: NodeJS.Timeout | null = null;

    public constructor(lookupInterval: number = 60 * 1000, init = true) {
        super();
        this.lookupInterval = lookupInterval;

        this.lights = [];
        this.ssdp = null;
        this.interval = null;

        if (init) {
            this.init();
        }
    }

    public getLights(): Yeelight[] {
        return this.lights;
    }

    public pruneLights(): Yeelight[] {
        this.lights = this.lights.filter(light => {
            if (light.isConnected()) {
                return true;
            }
            light.destroy();
            return false;
        });
        return this.lights;
    }

    public init(): void {
        this.stop();

        // start lookup
        this.lookup();

        // start lookup interval
        this.interval = setInterval(() => {
            this.lookup();
        }, this.lookupInterval);
    }

    public stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    public lookup(): void {
        // console.log('Lookup.lookup...');

        if (this.ssdp) {
            this.ssdp.stop();
        }

        this.ssdp = new ssdp.Client({ssdpPort: YEELIGHT_SSDP_PORT});

        this.ssdp.on('response', (data: SsdpHeaders) => {
            const light = this.lights.find(l => l.id === data.ID);
            if (light) {
                light.updateBySSDPMessage(data);
            } else {
                const newLight = new Yeelight(data);
                this.lights.push(newLight);

                // get mac (but it could be that there is no mac because of different (routed) net)
                arp.getMAC(newLight.host, (err, mac) => {
                    newLight.mac = (!err) ? mac : '';
                    this.emit('detected', newLight);
                });
            }
        });

        void this.ssdp.search('wifi_bulb');
    }

    // public searchSSDP(maxRetries: number): void {
    //     let amount = 0;
    //
    //     const lightsAtStartup = this.lights.length;
    //
    //     const interval = setInterval(() => {
    //         if (amount > maxRetries || (lightsAtStartup != this.lights.length && this.lights.length > 0)) {
    //             clearInterval(interval);
    //             return;
    //         }
    //
    //         this.lookup();
    //         //console.log("searching ("+amount+")...");
    //
    //         ++amount;
    //     }, SEARCH_INTERVAL);
    // }

    // public findByPortScanning(): Promise<unknown> {
    //     const interfaces = os.networkInterfaces();
    //
    //     // first: get all IPs of all network interfaces
    //     let ipAddresses: string[] = [];
    //
    //     Object.values(interfaces).forEach(iface => {
    //         iface?.forEach((alias) => {
    //             if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
    //                 ipAddresses.push(alias.address);
    //             }
    //         });
    //     });
    //
    //     // remove last digit
    //     ipAddresses = ipAddresses.map(ip => ip.substr(0, ip.lastIndexOf('.') + 1));
    //
    //     // filter doubles
    //     ipAddresses = ipAddresses.filter((item, i, self) => self.lastIndexOf(item) === i);
    //
    //     // loop over all IPs and check for open ports
    //     const checkAmount = ipAddresses.length * 254;
    //     let checks = 0;
    //
    //     return new Promise(resolve => {
    //         ipAddresses.forEach(truncatedIp => {
    //             for (let t = 1; t < 255; ++t) {
    //                 const ip = `${truncatedIp}${t}`;
    //                 portscanner.checkPortStatus(
    //                     YEELIGHT_PORT,
    //                     {host: ip, timeout: PORT_SCAN_TIMEOUT},
    //                     (error, status) => {
    //                         ++checks;
    //
    //                         if (status === 'open') {
    //                             // get mac (but it could be that there is no mac because of different (routed) net)
    //                             arp.getMAC(ip, (err, mac) => {
    //                                 console.log(`IP ${ip} seems open, mac? ${mac}, err? ${err ? 'yes' : 'no'}`);
    //
    //                                 // check if already added
    //                                 let light;
    //                                 if (!err) {
    //                                     light = this.lights.find(l => l.mac === mac);
    //                                 } else {
    //                                     light = this.lights.find(l => l.host === ip);
    //                                 }
    //
    //                                 if (!light) {
    //                                     light = new Yeelight();
    //                                     light.init(ip, YEELIGHT_PORT, (!err) ? mac : '');
    //                                     this.lights.push(light);
    //                                     this.emit('detected', light);
    //                                 }
    //                             });
    //                         }
    //
    //                         // on done -> end
    //                         if (checks === checkAmount) {
    //                             resolve(void 0);
    //                         }
    //                     },
    //                 );
    //             }
    //         });
    //     });
    // }
}
