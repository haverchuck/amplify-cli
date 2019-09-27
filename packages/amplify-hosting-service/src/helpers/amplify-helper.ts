import { AmplifyContext, App, Job } from '../types';
import { ClientFactory } from '../clients/client-factory';
import { put } from 'request-promise';
import * as fs from 'fs-extra';
import AWS from 'aws-sdk';
import ora from 'ora';

const DEPLOY_ARTIFACTS_MESSAGE = "Deploying build artifacts to the Amplify Console..";
const DEPLOY_COMPLETE_MESSAGE = "Deployment complete!";

export class AmplifyHelper {
    private context: AmplifyContext;
    private clientFactory: ClientFactory;
    private amplifyClient: AWS.Amplify;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.clientFactory = new ClientFactory(context);
    }

    async publishFileToAmplify(zipPath: string, app: App) {
        await this.initClient();
        const spinner = ora();
        spinner.start(DEPLOY_ARTIFACTS_MESSAGE);
        const jobParams = app;
        await this.cancelAllPendingJob(app);
        const { zipUploadUrl, jobId } = await this.amplifyClient.createDeployment(app).promise();
        await this.httpPutFile(zipPath, zipUploadUrl);
        const result = await this.amplifyClient.startDeployment({ ...jobParams, jobId }).promise();
        await this.waitJobToSucceed({ appId: app.appId, branchName: app.branchName, jobId });
        spinner.succeed(DEPLOY_COMPLETE_MESSAGE);
    }

    async doesAppExist(appId: string): Promise<boolean> {
        await this.initClient();
        let doExist = true;
        await this.amplifyClient.getApp({ appId }).promise().catch(err => {
            if (err.code === 'NotFoundException') {
                doExist = false;
            } else {
                throw err;
            }
        });
        return doExist;
    }

    async generateBranchDomainMap(appId: string): Promise<Map<string, string[]>> {
        let branchMap = new Map<string, string[]>();
        await this.initClient();
        const appResult = await this.amplifyClient.getApp({ appId }).promise();
        const { defaultDomain } = appResult.app;
        const response = await this.amplifyClient.listDomainAssociations({
            appId
        }).promise();
        response.domainAssociations.forEach(domainAssociation => {
            if (domainAssociation.domainStatus !== 'AVAILABLE') {
                return;
            }
            const domainName = domainAssociation.domainName;
            domainAssociation.subDomains.forEach(subDomain => {
                const { branchName, prefix } = subDomain.subDomainSetting;
                if (!branchMap.get(branchName)) {
                    branchMap.set(branchName, [`${prefix}.${domainName}`]);
                } else {
                    branchMap.set(branchName, [...branchMap.get(branchName), `${prefix}.${domainName}`]);
                }
            });
        });
        const result = await this.amplifyClient.listBranches({ appId }).promise();
        result.branches.forEach(branch => {
            const { branchName } = branch
            if (branchMap.get(branchName)) {
                branchMap.set(branchName, [...branchMap.get(branchName), `${branchName}.${defaultDomain}`]);
            } else {
                branchMap.set(branchName, [`${branchName}.${defaultDomain}`]);
            }
        });
        return branchMap;
    }

    async removeBranch(app: App) {
        await this.initClient();
        await this.amplifyClient.deleteBranch(app).promise();
    }

    async getBranchNames(appId: string): Promise<string[]> {
        await this.initClient();
        const result = await this.amplifyClient.listBranches({ appId }).promise();
        return result.branches.map(branch => branch.branchName);
    }

    private async cancelAllPendingJob(appInfo: App) {
        await this.initClient();
        const { jobSummaries } = await this.amplifyClient.listJobs(appInfo).promise();
        for (let jobSummary of jobSummaries) {
            const { jobId, status } = jobSummary;
            if (status === 'PENDING' || status === 'RUNNING') {
                const job = { ...appInfo, jobId };
                await this.amplifyClient.stopJob(job).promise();
            }
        }
    }

    private waitJobToSucceed(job: Job) {
        return new Promise(async (resolve, reject) => {
            await this.initClient();
            const timeout = setTimeout(() => {
                console.log('Job Timeout before succeeded');
                reject();
            }, 1000 * 60 * 10);

            while (true) {
                const getJobResult = await this.amplifyClient.getJob(job).promise();
                const jobSummary = getJobResult.job.summary;
                if (jobSummary.status === 'FAILED') {
                    console.log('Job failed.' + JSON.stringify(jobSummary));
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                if (jobSummary.status === 'SUCCEED') {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                await this.sleep(1000 * 3);
            }
        });
    }

    private async initClient() {
        if (!this.amplifyClient) {
            this.amplifyClient = await this.clientFactory.getAmplifyClient();
        }
    }

    private sleep(ms: number) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, ms);
        });
    }

    private async httpPutFile(filePath: string, url: string) {
        const result = await put({
            body: fs.readFileSync(filePath),
            url
        });
    }
}