export interface LocalEnvInfo {
    envName: string,
    projectPath: string
}


export interface AmplifyMeta {
    providers: {
        awscloudformation: AWSCloudFormation
    }
    hosting?: HostingMetaConfig
}

export interface AWSCloudFormation {
    Region: string,
    StackId: string
}

export interface PathManager {
    getAmplifyConsolePath: (path: string) => string,
    getProjectConfigFilePath: (path: string) => string
}

export interface Amplify {
    readJsonFile: (path: string) => any,
    updateamplifyMetaAfterResourceDelete: (category: string, resourceName: string) => void,
    updateamplifyMetaAfterResourceAdd: (category: string, resourceName: string, option: AmplifyMetaConfig) => void,
    getEnvInfo: () => LocalEnvInfo,
    getProjectConfig: () => any,
    getProjectMeta: () => AmplifyMeta,
    pathManager: PathManager
}

export interface Print {
    info: (input: any) => any;
}

export interface AmplifyContext {
    amplify: Amplify,
    print: Print
}

export interface CFNParameters {
    Name?: string,
    Description?: string,
    BasicAuthConfig?: BasicAuthConfig,
    CustomRules?: CustomRule[],
    BranchesAfterEdit?: string[],
    Branches?: string[]
}

export interface BasicAuthConfig {
    EnableBasicAuth?: boolean,
    Password?: string,
    Username?: string
}

export interface CustomRule {
    Condition?: string,
    Source: string,
    Status?: string,
    Target?: string
}

export interface CFNTemplate {
    Resources: CFNResources
}

export interface CFNResources {
    AmplifyApp: AppTemplate
}

export interface AppTemplate {
    Properties: AppProperties
}

export interface AppProperties {
    Name?: any
    Description?: any
    BasicAuthConfig?: any
    CustomRules?: any
}
export interface BranchTemplate {
    Properties: BranchProperties
    Type: string
    DependsOn: string
}

export interface BranchProperties {
    BranchName: any,
    AppId: any
}

export interface AmplifyApp {
    appId: string,
    defaultDomain: string
}


export type App = {
    appId: string,
    branchName: string
};

export type Job = App & {
    jobId : string
};

export interface HostingConfig {
    amplifyconsole: AmplifyConfig
}

export interface AmplifyConfig {
    deployType: DeployType,
    appId ?: string
    stackName ?: string
}

export interface Categories {
    hosting: HostingConfig
}

export interface HostingMetaConfig {
    AmplifyConsole?: AmplifyMetaConfig
}

export interface AmplifyMetaConfig {
    service: string
    deployType: DeployType,
    status: 'No Change'
}

export type DeployType = 'Manual' | 'CICD' | 'Help'

export type BranchOperation = 'Delete' | 'Create'
