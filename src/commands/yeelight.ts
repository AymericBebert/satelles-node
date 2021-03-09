import { ICommand } from '../model/satelles';
import { rgb2temp } from '../ts-yeelight-wifi/color-temp';
import { Yeelight } from '../ts-yeelight-wifi/yeelight';

export function yeelightCommands(yl: Yeelight | null): ICommand[] {
    if (yl === null) {
        return [];
    }
    const powerCommand: ICommand[] = yl.power ? [{
        name: 'YL Turn Off',
        type: 'action',
    }] : [{
        name: 'YL Turn On',
        type: 'action',
    }];
    return [
        ...powerCommand,
        {
            name: 'YL Blink',
            type: 'action',
        },
        {
            name: 'YL Control',
            type: 'complex',
            args: [
                {
                    name: 'Brightness',
                    type: 'number',
                    numberValue: yl.bright,
                    numberMin: 1,
                    numberMax: 100,
                    numberStep: 1,
                },
                {
                    name: 'Temperature',
                    type: 'number',
                    numberValue: rgb2temp([yl.rgb.r, yl.rgb.g, yl.rgb.b]),
                    numberMin: 1700,
                    numberMax: 6500,
                    numberStep: 100,
                },
            ],
        },
    ];
}
