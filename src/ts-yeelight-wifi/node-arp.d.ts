declare module 'node-arp' {

    function getMAC(ipaddress: string, cb: (err: boolean, code: string) => void): void;

}
