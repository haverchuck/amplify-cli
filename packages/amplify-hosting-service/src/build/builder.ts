import { spawn } from 'child_process';
import chalk from 'chalk';

export class Builder {
    run(command: string, projectDirectory: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let args = command.split(/\s+/);
            const cmd = args[0];
            args = args.slice(1);
            const execution = spawn(cmd, args, { cwd: projectDirectory, env: process.env, stdio: 'inherit' });

            let rejectFlag = false;
            execution.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else if (!rejectFlag) {
                    rejectFlag = true;
                    reject(code);
                }
            });

            execution.on('error', err => {
                console.log(chalk.red(`command execution teminated with error`));
                if (!rejectFlag) {
                    rejectFlag = true;
                    reject(err);
                }
            })
        });
    }
}