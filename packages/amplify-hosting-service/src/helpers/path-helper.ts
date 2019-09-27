import * as path from 'path';
import { AmplifyContext } from '../types';
import { CommonHelper } from './index';
import * as Constants from '../constants';
import * as fs from 'fs-extra';

export class PathHelper {
    private context: AmplifyContext;
    private commonHelper: CommonHelper;
    constructor(context: AmplifyContext) {
        this.context = context;
        this.commonHelper = new CommonHelper(context);
    }

    getProjectPath(): string {
        return this.commonHelper.getLocalEnvInfo().projectPath;
    }

    getAmplifyPath(): string {
        return path.join(this.getProjectPath(), Constants.AMPLIFY_FOLDER_NAME);
    }

    getBackEndPath(): string {
        return path.join(this.getAmplifyPath(), Constants.BACKEND_FOLDER_NAME);
    }

    getHostingPath(): string {
        return path.join(this.getBackEndPath(), Constants.CATAGORIE);
    }

    getAmplifyConsolePath(): string {
        return path.join(this.getHostingPath(), Constants.AMPLIFY_CONSOLE_FOLDER_NAME);
    }

    getCFNParameterPath(): string {
        return path.join(this.getAmplifyConsolePath(), Constants.CFN_PARAMETER_NAME);
    }

    getCFNTemplatePath(): string {
        return path.join(this.getAmplifyConsolePath(), Constants.CFN_TEMPLATE_NAME);
    }

    getTeamProviderPath(): string {
        return path.join(this.getAmplifyPath(), Constants.TEAM_PROVIDER_FILE_NAME);
    }

    getAmplifyMetaPath(): string {
        return path.join(this.getBackEndPath(), Constants.AMPLIFY_META_FILE_NAME);
    }

    getBackendFilePath(): string {
        return path.join(this.getBackEndPath(), Constants.BACKEND_CONFIG_FILE_NAME);
    }

    getDotConfigPath(): string {
        return path.join(this.getAmplifyPath(), Constants.DOT_CONFIG);
    }

    getLocalAWSInfoPath(): string {
        return path.join(this.getDotConfigPath(), Constants.LOCAL_AWS_INFO);
    }

    ensureAmplifyFolder(): void {
        fs.ensureDirSync(this.getAmplifyPath());
        fs.ensureDirSync(this.getBackEndPath());
    }

    ensureHostingFolder(): void {
        fs.ensureDirSync(this.getHostingPath());
        fs.ensureDirSync(this.getAmplifyConsolePath());
    }
}
