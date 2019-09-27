import { AmplifyContext, DeployType } from './types';
import { ManualProcessor, CICDProcessor } from './processors/index';
import { QuestionHelper, CommonHelper } from './helpers';
import { ConfigHelper } from './helpers/config-helper';
import chalk from 'chalk';

const UNEXPECTED_OPERATION_MESSAGE = 'undefined operation';
const HELP_INFO_PLACE_HOLDER = `Manual deployment allows you to publish your web app to the Amplify Console without connecting a Git provider.\
Continuous deployment allows you to publish changes on every code commit by connecting your GitHub, Bitbucket, GitLab, or AWS CodeCommit repositories.`;

export class AmplifyConsole {
    private context: AmplifyContext;
    private questionHelper: QuestionHelper;
    private configHelper: ConfigHelper;
    private commonHelper: CommonHelper;
    private manualProcessor: ManualProcessor;
    private cicdProcessor: CICDProcessor;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.manualProcessor = new ManualProcessor(context);
        this.cicdProcessor = new CICDProcessor(context);
        this.questionHelper = new QuestionHelper(context);
        this.configHelper = new ConfigHelper(context);
        this.commonHelper = new CommonHelper(context);
    }

    async add(): Promise<void> {
        let doesSelectHelp = true;
        while (doesSelectHelp) {
            const deployType: DeployType = await this.questionHelper.askDeployType();
            switch (deployType) {
                case 'Manual': {
                    doesSelectHelp = false;
                    await this.manualProcessor.add();
                    break;
                }
                case 'CICD': {
                    doesSelectHelp = false;
                    await this.cicdProcessor.add();
                    break;
                }
                case 'Help': {
                    console.log(HELP_INFO_PLACE_HOLDER);
                    console.log('-------------------------------');
                    break;
                }
                default: {
                    chalk.red(UNEXPECTED_OPERATION_MESSAGE);
                }
            }
        }
    };

    async publish(): Promise<void> {
        const deployType: DeployType = this.configHelper.getDeployType();
        switch (deployType) {
            case 'Manual':
                await this.manualProcessor.publish();
                break;
            case 'CICD':
                await this.cicdProcessor.publish();
                break;
            default: {
                chalk.red(UNEXPECTED_OPERATION_MESSAGE);
            }
        }
    }

    async status(): Promise<void> {
        const deployType: DeployType = this.configHelper.getDeployType();
        switch (deployType) {
            case 'Manual':
                await this.manualProcessor.status();
                break;
            case 'CICD':
                await this.cicdProcessor.status();
                break;
            default: {
                chalk.red(UNEXPECTED_OPERATION_MESSAGE);
            }
        }
    }

    async configure(): Promise<void> {
        const deployType: DeployType = this.configHelper.getDeployType();
        switch (deployType) {
            case 'Manual':
                await this.manualProcessor.configure();
                break;
            case 'CICD':
                await this.cicdProcessor.configure();
                break;
            default: {
                chalk.red(UNEXPECTED_OPERATION_MESSAGE);
            }
        }
    }

    async remove(): Promise<void> {
        const deployType: DeployType = this.configHelper.getDeployType();
        switch (deployType) {
            case 'Manual':
                await this.manualProcessor.remove();
                break;
            case 'CICD':
                await this.cicdProcessor.remove();
                break;
            default: {
                chalk.red(UNEXPECTED_OPERATION_MESSAGE);
            }
        }
    }

    async console(): Promise<void> {
        const deployType: DeployType = this.configHelper.getDeployType();
        switch (deployType) {
            case 'Manual':
                await this.manualProcessor.console();
                break;
            case 'CICD':
                await this.cicdProcessor.console();
                break;
            default: {
                chalk.red(UNEXPECTED_OPERATION_MESSAGE);
            }
        }
    }
}


