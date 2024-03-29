import {CommandArgType} from './satelles';

export interface IArgValue {
    name: string;
    type: CommandArgType;
    stringValue?: string;
    numberValue?: number;
    booleanValue?: boolean;
    colorValue?: string;
    selectValue?: string;
}

export interface IImperiumAction {
    satellesId: string;
    commandName: string;
    args: IArgValue[];
}
