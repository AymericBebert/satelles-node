import type {CommandRunner} from './model/command-runner';

export async function commandRunnerFactory(name: string): Promise<CommandRunner> {
    if (name === 'debug') {
        const module = await import('./debug/debug-command-runner');
        return new module.DebugCommandRunner();
    } else if (name === 'macos') {
        const module = await import('./macos/macos-command-runner');
        return new module.MacOsCommandRunner();
    } else if (name === 'yeelight') {
        const module = await import('./yeelight/yeelight-command-runner');
        return new module.YeelightCommandRunner();
    } else if (name === 'heater') {
        const module = await import('./heater/heater-command-runner');
        return new module.HeaterCommandRunner();
    } else if (name === 'hue') {
        const module = await import('./hue/hue-command-runner');
        return new module.HueCommandRunner();
    } else {
        throw new Error(`No module with name: ${name}`);
    }
}
