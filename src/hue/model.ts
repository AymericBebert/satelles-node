export interface HueScenarioLamp {
    name: string;
    on: boolean;
    brightness: number;
    temperature: number;
}

export interface HueScenario {
    name: string;
    lamps: HueScenarioLamp[];
}
