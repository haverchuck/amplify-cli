import { AmplifyContext, HostingConfig, AmplifyMetaConfig, DeployType, Categories, AmplifyConfig } from '../types';
import { PathHelper, AmplifyHelper, StackHelper, CommonHelper } from './index';
import { AMPLIFY_CONSOLE, CATAGORIE } from '../constants';
import * as fs from 'fs-extra';

export class ConfigHelper {
    private context: AmplifyContext;
    private pathHelper: PathHelper;
    private amplifyHelper: AmplifyHelper;
    private stackHelper: StackHelper;
    private commonHelper: CommonHelper;
    private teamProviderFilePath: string;
    private amplifyMetaFilePath: string;
    private backEndConfigFilePath: string;
    private currentEnv: string;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.pathHelper = new PathHelper(context);
        this.amplifyHelper = new AmplifyHelper(context);
        this.stackHelper = new StackHelper(context);
        this.commonHelper = new CommonHelper(context);
        this.teamProviderFilePath = this.pathHelper.getTeamProviderPath();
        this.amplifyMetaFilePath = this.pathHelper.getAmplifyMetaPath();
        this.backEndConfigFilePath = this.pathHelper.getBackendFilePath();
        this.currentEnv = this.commonHelper.getLocalEnvInfo().envName;
    }

    private loadConfig(path: string) {
        return this.context.amplify.readJsonFile(path);
    }

    private writeConfig(content: any, path: string) {
        let jsonString = JSON.stringify(content, null, 4);
        fs.writeFileSync(path, jsonString, 'utf8');
    }

    updateTeamConfig(env: string, hostConfig: HostingConfig) {
        let content = this.loadConfig(this.teamProviderFilePath);
        if (!content[env].categories) {
            content[env].categories = { hosting: hostConfig };
        } else {
            content[env].categories.hosting = hostConfig;
        }
        this.writeConfig(content, this.teamProviderFilePath);
    }

    deleteHostingForTeamConfig(env: string) {
        let content = this.loadConfig(this.teamProviderFilePath);
        if (!content[env] || !content[env].categories) {
                return;
        }
        let categories: Categories = content[env].categories;
        if (categories.hosting
            && categories.hosting.amplifyconsole) {
            categories.hosting.amplifyconsole = undefined;
        }
        this.writeConfig(content, this.teamProviderFilePath);
    }

    async getExistAppIdFromTeamConfig(): Promise<string> {
        let content = this.loadConfig(this.teamProviderFilePath);
        const envs = Object.keys(content);
        for (let envName of envs) {
            const env = content[envName];
            if (!env.categories) {
                return null;
            }
            let categories: Categories = env.categories;
            if (categories.hosting
                && env.categories.hosting.amplifyconsole
                && env.categories.hosting.amplifyconsole.appId) {
                const appId = content[envName].categories.hosting.amplifyconsole.appId;
                if (await this.amplifyHelper.doesAppExist(appId)) {
                    return appId;
                };
            }
        }
        return null;
    }

    async getExistStackNameFromTeamConfig(content: any): Promise<string> {
        const envs = Object.keys(content);
        for (let envName of envs) {
            const env = content[envName];
            if (env.categories) {
                let categories: Categories = env.categories;
                if (categories
                    && categories.hosting
                    && categories.hosting.amplifyconsole
                    && categories.hosting.amplifyconsole.stackName) {
                    const stackName = categories.hosting.amplifyconsole.stackName;
                    if (await this.stackHelper.doesStackExist(stackName)) {
                        return stackName;
                    };
                }
            }
        }
        return null;
    }

    private async initStackNameWithTeamConfig(): Promise<string> {
        let content = this.loadConfig(this.teamProviderFilePath);
        let stackName = await this.getExistStackNameFromTeamConfig(content);
        return stackName ? stackName : `${this.commonHelper.generateUniqueStackName()}`
    }

    loadAllEnvsFromTeamConfig(): Map<string, AmplifyConfig>  {
        let context = this.loadConfig(this.teamProviderFilePath);
        let envsMap = new Map<string, AmplifyConfig>();
        Object.keys(context).forEach( env => {
            let categories: Categories = context[env].categories;
            if (categories &&
                categories.hosting &&
                categories.hosting.amplifyconsole) {
                envsMap.set(env, categories.hosting.amplifyconsole);
            }
        });
        return envsMap;
    }

    loadStackNameByEnvFromTeamConfig(envName: string): string {
        let content = this.loadConfig(this.teamProviderFilePath);
        const env = content[envName];
        if (!env || !env.categories) {
            return null;
        }
        let categories: Categories = env.categories;
        if (categories.hosting
            && categories.hosting.amplifyconsole
            && categories.hosting.amplifyconsole.stackName
        ) {
            return categories.hosting.amplifyconsole.stackName;
        }
        return null;
    }

    loadAppIdByEnvFromTeamConfig(envName: string): string {
        let content = this.loadConfig(this.teamProviderFilePath);
        const env = content[envName];
        if (!env || !env.categories) {
            return null;
        }
        let categories: Categories = env.categories;
        if (categories.hosting
            && categories.hosting.amplifyconsole
            && categories.hosting.amplifyconsole.appId
        ) {
            return categories.hosting.amplifyconsole.appId;
        }
        return null;
    }

    async initStackName(): Promise<string> {
        const { envName } = this.commonHelper.getLocalEnvInfo();
        if (this.loadStackNameByEnvFromTeamConfig(envName)) {
            return this.loadStackNameByEnvFromTeamConfig(envName);
        } else {
            return this.initStackNameWithTeamConfig();
        }
    }

    async initAppId(): Promise<string> {
        const { envName } = this.commonHelper.getLocalEnvInfo();
        if (this.loadAppIdByEnvFromTeamConfig(envName)) {
            return this.loadAppIdByEnvFromTeamConfig(envName);
        } else {
            return this.getExistAppIdFromTeamConfig();
        }
    }

    writeToAmplifyMeta(deployType: DeployType) {
        this.context.amplify.updateamplifyMetaAfterResourceAdd(CATAGORIE, AMPLIFY_CONSOLE, {
            service: AMPLIFY_CONSOLE,
            deployType,
            status: 'No Change'
        });
    }

    deleteAmplifyMeta() {
        const metaContent = this.loadConfig(this.amplifyMetaFilePath);
        if (metaContent.hosting && metaContent.hosting.AmplifyConsole) {
            metaContent.hosting.AmplifyConsole = undefined;
        }

        const backEndContent = this.loadConfig(this.backEndConfigFilePath);
        if (backEndContent.hosting && backEndContent.hosting.AmplifyConsole) {
            backEndContent.hosting.AmplifyConsole = undefined;
        }
        this.writeConfig(metaContent, this.amplifyMetaFilePath);
        this.writeConfig(backEndContent, this.backEndConfigFilePath);
    }

    getDeployType(): DeployType {
        const content = this.loadConfig(this.amplifyMetaFilePath);
        return content.hosting.AmplifyConsole.deployType;
    }

    isHostingEanbled(): boolean {
        let isValid = true;
        try {
            const content = this.loadConfig(this.amplifyMetaFilePath);
            if (!content.hosting.AmplifyConsole) {
                isValid = false;
            }
        } catch {
            isValid = false;
        }
        return isValid
    }

    isResourcePublished(): boolean {
        let isValid = true;
        try {
            const content = this.loadConfig(this.teamProviderFilePath)[this.currentEnv];
            if (!content.categories.hosting.amplifyconsole.stackName && !content.categories.hosting.amplifyconsole.appId) {
                isValid = false;
            }
        } catch (err) {
            console.log(err);
            isValid = false;
        }
        return isValid;
    }
}