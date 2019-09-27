import { AmplifyContext, AmplifyMeta, LocalEnvInfo, AmplifyConfig } from '../types';
import { PathHelper, ConfigHelper, StackHelper} from './index';
import * as fs from 'fs-extra';
import ora from 'ora';

const START_CLEAN_RESOURCE_MESSAGE = 'Cleaning local resources';
const CLEAN_RESOUCE_SUCCESS_MESSAGE = 'Completed cleaning local resources';
export class CleanHelper {
    context: AmplifyContext;
    pathHelper: PathHelper;
    configHelper: ConfigHelper;
    stackHelper: StackHelper;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.pathHelper = new PathHelper(context);
        this.configHelper = new ConfigHelper(context);
        this.stackHelper = new StackHelper(context);
    }

    async clean() {
        await this.cleanCloudResources();
        this.cleanLocalResources();
    }

    private async cleanCloudResources() {
        const envsMap = this.configHelper.loadAllEnvsFromTeamConfig();
        let promiseList: Promise<any>[] = [];
        envsMap.forEach( (config, envName) => {
            switch (config.deployType) {
                case 'CICD':
                    break;
                case 'Manual':
                    promiseList.push(this.stackHelper.deleteCFNStackByEnv(config.stackName, envName));
                    break;
            }
        });
        await Promise.all(promiseList);
    }

    private cleanLocalResources() {
        const spinner = ora();
        spinner.start(START_CLEAN_RESOURCE_MESSAGE);
        const envsMap = this.configHelper.loadAllEnvsFromTeamConfig();
        envsMap.forEach( (config, envName) => {
            this.configHelper.deleteHostingForTeamConfig(envName);
        });
        this.configHelper.deleteAmplifyMeta();
        fs.removeSync(this.pathHelper.getAmplifyConsolePath());
        spinner.succeed(CLEAN_RESOUCE_SUCCESS_MESSAGE);
    }
}