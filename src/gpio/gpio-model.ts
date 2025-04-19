export interface GpioConfig {
    name: string;
    pin: number;
    pullUp?: boolean;
    pullDown?: boolean;
    initialValue?: number;
    invert?: boolean;
    actOnMode?: boolean;
    onForTimes?: string[];
}
