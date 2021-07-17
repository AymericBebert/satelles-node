import {DebugCommandRunner} from './debug/debug-command-runner';
import {MacOsCommandRunner} from './macos/macos-command-runner';
import {CommandRunner} from './model/command-runner';
import {YeelightCommandRunner} from './yeelight/yeelight-command-runner';

export function commandRunnerFactory(name: string): CommandRunner | null {
    switch (name) {
        case 'debug':
            return new DebugCommandRunner();
        case 'macos':
            return new MacOsCommandRunner();
        case 'yeelight':
            return new YeelightCommandRunner();
        default:
            console.error('No module with name:', name);
            return null;
    }
}
