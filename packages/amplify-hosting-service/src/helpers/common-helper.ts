import { AmplifyContext, AmplifyMeta, LocalEnvInfo } from '../types';

export class CommonHelper {
    private context: AmplifyContext;
    constructor(context: AmplifyContext) {
        this.context = context;
    }

    getDefaultProjectName(): string {
        const projectPath = process.cwd();
        const projectConfigFilePath = this.context.amplify.pathManager.getProjectConfigFilePath(projectPath);
        return this.context.amplify.readJsonFile(projectConfigFilePath).projectName;
    }

    generateUniqueStackName(): string {
        return `${this.getDefaultProjectName()}-aws-amplify-console-${(new Date()).getTime()}`;
    }

    getRegion(): string {
        return this.getProjectMeta().providers.awscloudformation.Region;

    }

    getProjectMeta(): AmplifyMeta {
        return this.context.amplify.getProjectMeta();
    }

    getProjectConfig() {
        return this.context.amplify.getProjectConfig();
    }

    getLocalEnvInfo(): LocalEnvInfo {
        return this.context.amplify.getEnvInfo();
    }
}
