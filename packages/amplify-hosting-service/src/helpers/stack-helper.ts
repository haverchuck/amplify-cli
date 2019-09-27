import { ClientFactory } from '../clients/client-factory';
import { CFNTemplate, AmplifyContext } from '../types';
import AWS from 'aws-sdk';
import ora from 'ora';

type WAIT_FOR_TYPE = 'stackExists' | 'stackCreateComplete' | 'stackDeleteComplete' | 'stackUpdateComplete' | 'changeSetCreateComplete';
export type STACK_OPERATION_TYPE = 'Create' | 'Update';

const CREATING_STACK_MESSAGE = 'Creating Amplify Console resources in the cloud.';
const CREATING_STACK_SUCCESS_MESSAGE = 'Creating Amplify Console resources complete!';
const UPDATING_STACK_MESSAGE = 'Updating Amplify Console resources in the cloud.';
const UPDATING_STACK_SUCCESS_MESSAGE = 'Updating Amplify Console resources complete!';
const CFN_NO_UPDATE_KEY_WORD = 'No updates are to be performed';
const VALIDATION_ERROR = 'ValidationError';
const UNEXPECTED_OPERATION = 'Unexpected operation';
const CFN_DOES_NOT_EXIST_KEY_WORD = 'does not exist';

const START_DELETING_MESSAGE = `Deleting Amplify Console stack`;
const DELETING_FAILED_MESSAGE = `Deleting Amplify Console stack failed.`;
const DELETING_SUCCEED_MESSAGE = `Deleting Amplify Console stack completed.`;

export class StackHelper {
    private context: AmplifyContext;
    private clientFactory: ClientFactory;
    private cfnClient: AWS.CloudFormation;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.clientFactory = new ClientFactory(context);
    }

    async deployCFNStack(template: CFNTemplate, stackName: string): Promise<string> {
        await this.initClient();
        const params = {
            StackName: stackName,
            TemplateBody: JSON.stringify(template, null, 4)
        };
        const type: STACK_OPERATION_TYPE = await this.doesStackExist(stackName) ? 'Update' : 'Create';
        const spinner = ora();
        switch (type) {
            case 'Create': {
                spinner.start(CREATING_STACK_MESSAGE);
                await this.cfnClient.createStack(params).promise();
                const waitForStatus: WAIT_FOR_TYPE = 'stackCreateComplete';
                await this.cfnClient.waitFor(waitForStatus, { StackName: stackName }).promise();
                spinner.succeed(CREATING_STACK_SUCCESS_MESSAGE);
                return stackName;
            }
            case 'Update': {
                let doUpdate: boolean = true;
                spinner.start(UPDATING_STACK_MESSAGE);
                await this.cfnClient.updateStack(params).promise().catch(err => {
                    if (err.code === VALIDATION_ERROR && err.message.includes(CFN_NO_UPDATE_KEY_WORD)) {
                        doUpdate = false;
                        spinner.succeed(UPDATING_STACK_SUCCESS_MESSAGE);
                    } else {
                        throw err;
                    }
                });
                if (!doUpdate) {
                    return stackName;
                }
                const waitForStatus: WAIT_FOR_TYPE = 'stackUpdateComplete';
                await this.cfnClient.waitFor(waitForStatus, { StackName: stackName }).promise();
                spinner.succeed(UPDATING_STACK_SUCCESS_MESSAGE);
                return stackName;
            }
            default:
                throw new Error(UNEXPECTED_OPERATION);
        }
    }

    async deleteCFNStack(stackName: string): Promise<void> {
        let doDelete: boolean = true;
        await this.initClient();
        const params = {
            StackName: stackName
        };
        const spinner = ora('');
        spinner.start(START_DELETING_MESSAGE);
        await this.cfnClient.deleteStack(params).promise().catch(err => {
            if (err.code === VALIDATION_ERROR) {
                spinner.succeed(DELETING_SUCCEED_MESSAGE);
                doDelete = false;
            } else {
                spinner.fail(DELETING_FAILED_MESSAGE);
                throw err;
            }
        });
        if (!doDelete) {
            return;
        }
        const waitForStatus: WAIT_FOR_TYPE = "stackDeleteComplete";
        await this.cfnClient.waitFor(waitForStatus, { StackName: stackName }).promise();
        spinner.succeed(DELETING_FAILED_MESSAGE);
    }

    async deleteCFNStackByEnv(stackName: string, envName: string): Promise<void> {
        let doDelete: boolean = true;
        const cfnClient = await this.initClientWithEnv(envName);
        const params = {
            StackName: stackName
        };
        const spinner = ora('');
        spinner.start(`Deleting Amplify Console stack for ${envName} environment`);
        await cfnClient.deleteStack(params).promise().catch(err => {
            if (err.code === VALIDATION_ERROR) {
                spinner.succeed(`Deleting Amplify Console stack for ${envName} environment completed.`);
                doDelete = false;
            } else {
                spinner.fail(`Deleting Amplify Console stack for ${envName} environment failed.`);
                throw err;
            }
        });
        if (!doDelete) {
            return;
        }
        const waitForStatus: WAIT_FOR_TYPE = "stackDeleteComplete";
        await cfnClient.waitFor(waitForStatus, { StackName: stackName }).promise();
        spinner.succeed(`Deleting Amplify Console stack for ${envName} environment completed.`);
    }

    async doesStackExist(stackName: string): Promise<boolean> {
        let doesStackExist = true;
        await this.initClient();
        const params = {
            StackName: stackName
        };
        await this.cfnClient.describeStacks(params).promise().catch(err => {
            if (err.code === VALIDATION_ERROR && err.message.includes(CFN_DOES_NOT_EXIST_KEY_WORD)) {
                doesStackExist = false;
            } else {
                throw err;
            }
        });
        return doesStackExist;
    }

    private async initClient() {
        if (!this.cfnClient) {
            this.cfnClient = await this.clientFactory.getCFNClient();
        }
    }

    private async initClientWithEnv(envName: string): Promise<AWS.CloudFormation> {
        return this.clientFactory.getCFNClient(envName);
    }


    async getStackOutputs(stackName: string): Promise<any> {
        await this.initClient();
        const params = {
            StackName: stackName
        };
        const data = await this.cfnClient.describeStacks(params).promise();
        let result = {};
        data.Stacks[0].Outputs.forEach(output => {
            result[output.OutputKey] = output.OutputValue;
        });
        return result;
    }

    async getStackTemplate(stackName: string): Promise<CFNTemplate> {
        await this.initClient();
        const params = {
            StackName: stackName
        };
        const data = await this.cfnClient.getTemplate(params).promise().catch(err => {
            if (err.code !== VALIDATION_ERROR || !err.message.includes(CFN_DOES_NOT_EXIST_KEY_WORD)) {
                throw err;
            }
        });
        if (data) {
            return JSON.parse(data.TemplateBody);
        } else {
            return null;
        }
    }
}