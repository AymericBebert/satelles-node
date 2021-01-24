import {ICommand} from '../model/satelles';

export function yeelightCommands(): ICommand[] {
    return [
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
                    numberValue: 42,
                    numberMin: 0,
                    numberMax: 100,
                    numberStep: 1,
                },
            ],
        },
    ];
}
