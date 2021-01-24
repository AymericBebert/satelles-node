export type RerumNodeConfig = {
    hub: {
        serverUrl: string;
        roomToken: string;
        roomName: string;
        deviceId: string;
        deviceName: string;
    };
    commands: ('macos' | 'yeelight')[];
}
