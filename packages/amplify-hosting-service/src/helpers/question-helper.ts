import * as inquirer from 'inquirer';
import { AmplifyContext, CFNParameters, BasicAuthConfig, CFNTemplate, DeployType, CustomRule, BranchOperation } from '../types';
import { TemplateHelper } from './index';
import chalk from 'chalk';
import open from 'open';
import { success } from 'log-symbols';
import { CommonHelper } from './common-helper';
import * as Utils from '../utils/index';

const DEPLOY_TYPE_QUESTION = `Choose a ${chalk.red('type')}`;
const DEPLOY_TYPE_QUESTION_MANUAL = 'Manual deployment';
const DEPLOY_TYPE_QUESTION_CICD = 'Continuous deployment (Git-based deployments)';
const LEARN_MORE = 'Learn more';
const SELECT_CONFIG_QUESTION = "Configure settings for all frontends:";
const SELECT_CONFIG_COMPLETION = "Apply configuration";

const SELECT_REMOVE_FRONTEND_QUESTION = "Select frontends to remove"


const BASIC_AUTH_USERNAME_QUESTION = "Enter username";
const BASIC_AUTH_PASSWORD_QUESTION = "Enter password";
const CONFIRM_QUESTION = "Confirm?";
const BASIC_AUTH_DISABLE_QUESTION = "Disable basic auth";
const BASIC_AUTH_EDIT_QUESTION = "Edit basic auth";

const CREATE_NEW_CUSTOM_RULE_QUESTIION = "Create new custom rule";
const DELETE_CUSTOM_RULE_QUESTION = "Delete custom rule";
const EDIT_CUSTOM_RULE_QUESTION = "Edit custom rule";
const EDIT_SOURCE_QUESTION = "Please input source url";
const EDIT_TARGET_QUESTION = "Please input target url";
const EDIT_STATUS_CODE = "Please input status code";
const EDIT_COUNTRY_CODE = "Please input contry code(enter to skip)";
const SELECT_DELETE_CUSTOM_RULE_QUESTION = "Please select custom rules to delete";
const SELECT_EIDT_CUSTOM_RULE_QUESTION = "Please select custom rules to edit";

const SELECT_CONFIG_AUTH = "Access control";
const SELECT_CONFIG_RULES = "Redirects and rewrites";
const SELECT_DOMAIN_MANAGEMENT = "Domain management";
const SELECT_REMOVE_FRONTEND = "Remove frontend environment";
const SELECT_ADD_FRONTEND = "Add new frontend environment";

const PICKUP_FRONTEND_QUESTION = "Pick a frontend environment to deploy to:";
const ADD_NEW_FRONTEND_QUESTION = "Enter a frontend environment name (e.g. dev or prod):";

const CICD_CONFIRM_QUESTION = `Continuous deployment is configued ${chalk.red('in')} the browser.\
Once you complete the wizard please ${chalk.red('return')} here and enter your app Arn. Continue:`;
const INPUT_APP_ARN_QUESTION = `Please enter your Amplify Console App Arn (App Settings > General):`;
const CHANGE_APP_ARN_QUESTION = `Please enter your new Amplify Console App Arn (App Settings > General):`;

const VIEW_APP_QUESTION = `You have set up CI/CD with Amplify Console. \
Run ${chalk.green('git push')} from a connected branch to publish updates. \
Open your Amplify Console app to view connected branches?`

const VIEW_URL_QUESTION = 'Would you like to open the deployed website?';

const INPUT_BLANK_VALIDATION = 'Input can not be blank';
const STATUS_CODE_VALIDATION = 'Status code can only be number';
const FRONTEND_NAME_VALIDATION = 'The frontend environment already exists. Please input a new name';

interface QuestionType {
    configType?: BasicAuthConfig | CustomRule[] | string[],
    doesEdit: boolean
}

export class QuestionHelper {
    private templateHelper: TemplateHelper;
    private region: string;
    private commonHelper: CommonHelper;

    constructor(context: AmplifyContext) {
        this.templateHelper = new TemplateHelper(context);
        this.commonHelper = new CommonHelper(context);
        this.region = this.commonHelper.getRegion();
    }

    async askDeployType(): Promise<DeployType> {
        const { anwser } = await inquirer.prompt(
            [
                {
                    type: "list",
                    name: "anwser",
                    message: DEPLOY_TYPE_QUESTION,
                    choices: [
                        DEPLOY_TYPE_QUESTION_MANUAL,
                        DEPLOY_TYPE_QUESTION_CICD,
                        LEARN_MORE
                    ],
                    default: DEPLOY_TYPE_QUESTION_MANUAL
                }
            ]
        );
        switch (anwser) {
            case DEPLOY_TYPE_QUESTION_MANUAL:
                return 'Manual';
            case DEPLOY_TYPE_QUESTION_CICD:
                return 'CICD';
            case LEARN_MORE:
                return 'Help';
        }
    }

    async askAppConfigQuestion(template: CFNTemplate, appId: string): Promise<CFNParameters> {
        let selectConfigAuth = SELECT_CONFIG_AUTH;
        let selectConfigRules = SELECT_CONFIG_RULES;
        let selectDomainManagement = SELECT_DOMAIN_MANAGEMENT;
        let selectRemoveFrontend = SELECT_REMOVE_FRONTEND;
        let selectConfigCompletion = SELECT_CONFIG_COMPLETION;
        let selectAddFrontend = SELECT_ADD_FRONTEND;

        let doesBasicAuthEdit = false;
        let doesRulesEdit = false;
        let doesRemoveFrontEndEdit = false;

        let parameters: CFNParameters = this.templateHelper.getParametersFromTemplate(template);
        parameters.BranchesAfterEdit = this.templateHelper.getBranchesFromTemplate(template);
        parameters.Branches = this.templateHelper.getBranchesFromTemplate(template);

        const selectConfigKey = 'selectConfig';
        let notComplete = true;
        while (notComplete) {
            let questionList = [
                selectAddFrontend,
                selectConfigAuth,
                selectConfigRules,
                selectDomainManagement,
                selectConfigCompletion
            ]
            if (parameters.BranchesAfterEdit.length > 0) {
                if (!questionList.includes(selectRemoveFrontend)) {
                    questionList.splice(questionList.length - 1, 0, selectRemoveFrontend);
                }
            } else {
                if (questionList.includes(selectRemoveFrontend)) {
                    questionList.splice(questionList.indexOf(selectRemoveFrontend));
                }
            }
            const selections = await inquirer.prompt(
                [
                    {
                        type: "list",
                        name: selectConfigKey,
                        message: SELECT_CONFIG_QUESTION,
                        choices: questionList
                    }
                ]
            );
            switch (selections[selectConfigKey]) {
                case selectConfigAuth: {
                    const result: QuestionType = await this.askBaiscAuthQuestion({
                        configType: parameters.BasicAuthConfig, doesEdit: doesBasicAuthEdit
                    });
                    parameters.BasicAuthConfig = result.configType as BasicAuthConfig;
                    doesBasicAuthEdit = result.doesEdit;
                    selectConfigAuth = editMessageWithSymbol(selectConfigAuth, doesBasicAuthEdit);
                    break;
                }
                case selectConfigRules: {
                    const result = await this.askRedirectRewriteRuleQuestion({
                        configType: parameters.CustomRules,
                        doesEdit: doesRulesEdit
                    });
                    parameters.CustomRules = result.configType as CustomRule[];
                    doesRulesEdit = result.doesEdit;
                    selectConfigRules = editMessageWithSymbol(selectConfigRules, doesRulesEdit);
                    break;
                }
                case selectRemoveFrontend: {
                    const branchesToDelete = await this.askWhichBranchesToDeleteQuestion(parameters.BranchesAfterEdit);

                    if (branchesToDelete.length > 0) {
                        doesRemoveFrontEndEdit = true;
                    }
                    parameters.BranchesAfterEdit = parameters.BranchesAfterEdit.filter(branch => !branchesToDelete.includes(branch));
                    selectRemoveFrontend = editMessageWithSymbol(selectRemoveFrontend, doesRemoveFrontEndEdit);
                    break;
                }
                case selectAddFrontend: {
                    const branchToCreate = await this.askNewBranchName(parameters.BranchesAfterEdit);
                    parameters.BranchesAfterEdit.push(branchToCreate);
                    selectAddFrontend = editMessageWithSymbol(selectAddFrontend, true);
                    break;
                }
                case selectDomainManagement: {
                    await open(`https://${this.region}.console.aws.amazon.com/amplify/home?region=${this.region}#/${appId}/settings/domains`);
                    selectDomainManagement = editMessageWithSymbol(selectDomainManagement, true);
                    break;
                }
                case SELECT_CONFIG_COMPLETION: {
                    notComplete = false;
                    break;
                }
                default:
                    throw new Error('Unexpected config type');
            }
        }
        return parameters;
    }

    private async askNewBasicAuthQuestion(question: QuestionType): Promise<QuestionType> {
        const userNameKey = 'userNameKey';
        const passwordKey = 'passwordKey';
        const confirmKey = 'confirmKey';

        let basicAuthConfig: BasicAuthConfig = question.configType as BasicAuthConfig;

        const anwser = await inquirer.prompt(
            [
                {
                    type: "input",
                    name: userNameKey,
                    message: BASIC_AUTH_USERNAME_QUESTION,
                    validate: validateLength,
                    default: basicAuthConfig ? basicAuthConfig.Username : undefined
                },
                {
                    type: "password",
                    name: passwordKey,
                    validate: validateLength,
                    message: BASIC_AUTH_PASSWORD_QUESTION
                },
                {
                    type: "confirm",
                    name: confirmKey,
                    message: CONFIRM_QUESTION,
                    default: true
                }
            ]
        );

        if (anwser.confirmKey) {
            return {
                configType: {
                    EnableBasicAuth: true,
                    Username: anwser.userNameKey,
                    Password: anwser.passwordKey,
                },
                doesEdit: true
            }
        } else {
            return {
                configType: basicAuthConfig ? basicAuthConfig : undefined,
                doesEdit: question.doesEdit
            }
        }
    }

    private async askBaiscAuthQuestion(question: QuestionType): Promise<QuestionType> {
        const selectKey = 'selectKey';
        let basicAuthConfig: BasicAuthConfig = question.configType as BasicAuthConfig;
        if (basicAuthConfig) {
            const anwser = await inquirer.prompt([
                {
                    type: "list",
                    name: selectKey,
                    choices: [
                        basicAuthConfig ? BASIC_AUTH_DISABLE_QUESTION : undefined,
                        BASIC_AUTH_EDIT_QUESTION
                    ]
                }
            ]);
            if (anwser[selectKey] === BASIC_AUTH_EDIT_QUESTION) {
                return { ... await this.askNewBasicAuthQuestion(question), ... { doesEdit: true } };
            } else {
                return {
                    doesEdit: true
                }
            }
        } else {
            return this.askNewBasicAuthQuestion(question);
        }
    }

    private async askRedirectRewriteRuleQuestion(question: QuestionType): Promise<QuestionType> {
        let customRules = question.configType as CustomRule[];
        const selectKey = 'selectKey';
        if (customRules && customRules.length) {
            const anwser = await inquirer.prompt([{
                type: "list",
                name: selectKey,
                choices: [
                    CREATE_NEW_CUSTOM_RULE_QUESTIION,
                    DELETE_CUSTOM_RULE_QUESTION,
                    EDIT_CUSTOM_RULE_QUESTION
                ],
                default: CREATE_NEW_CUSTOM_RULE_QUESTIION
            }]);
            const option = await anwser[selectKey];
            switch (option) {
                case CREATE_NEW_CUSTOM_RULE_QUESTIION:
                    const newRule = await this.askNewCustomRuleQuestion();
                    if (newRule) {
                        question.doesEdit = true;
                        customRules.push(newRule);
                    }
                    break;
                case DELETE_CUSTOM_RULE_QUESTION:
                    const deletedRule = await this.askDeleteCustomRuleQuestion(customRules);
                    if (customRules.length === deletedRule.length) {
                        question.doesEdit = true;
                    }
                    customRules = deletedRule;
                    break;
                case EDIT_CUSTOM_RULE_QUESTION:
                    customRules = await this.askEditCustomRuleQuestion(customRules);
                    question.doesEdit = true;
                    break;
                default:
                    throw new Error('Unexpected config type');
            }
        } else {
            const newRule = await this.askNewCustomRuleQuestion();
            customRules = [];
            if (newRule) {
                customRules.push(newRule);
                question.doesEdit = true;
            }
        }
        return { ...question, ...{ configType: customRules } };
    }

    private async askNewCustomRuleQuestion(customRule?: CustomRule): Promise<CustomRule> {
        const conditionKey = 'conditionKey';
        const sourceKey = 'sourcekey';
        const targetKey = 'targetKey';
        const statusKey = 'status';
        const confirmKey = 'confirm';

        const anwser = await inquirer.prompt([
            {
                type: 'input',
                name: sourceKey,
                message: EDIT_SOURCE_QUESTION,
                validate: validateLength,
                default: customRule ? customRule.Source : undefined
            },
            {
                type: 'input',
                name: targetKey,
                message: EDIT_TARGET_QUESTION,
                validate: validateLength,
                default: customRule ? customRule.Target : undefined
            },
            {
                type: 'input',
                name: statusKey,
                message: EDIT_STATUS_CODE,
                validate: validateStatusCode,
                default: customRule ? customRule.Status : 200
            },
            {
                type: 'input',
                name: conditionKey,
                message: EDIT_COUNTRY_CODE,
                default: customRule ? customRule.Condition : undefined
            },
            {
                type: 'confirm',
                name: confirmKey,
                message: CONFIRM_QUESTION,
                default: true
            }
        ]);

        if (anwser[confirmKey]) {
            return {
                Source: anwser[sourceKey],
                Target: anwser[targetKey],
                Status: anwser[statusKey],
                Condition: anwser[conditionKey] ? conditionKey : undefined
            }
        } else {
            return customRule ? customRule : undefined
        }
    }

    private async askDeleteCustomRuleQuestion(customRules: CustomRule[]): Promise<CustomRule[]> {
        const questionKey = 'questionKey';
        let displayList: string[] = [];
        let customRuleMap: Map<string, CustomRule> = new Map();
        customRules.forEach((customRule, index) => {
            let customRuleName = `${index}:${customRule.Source}->${customRule.Target}:status:${customRule.Status}:contryCode:${customRule.Condition}`;
            displayList.push(customRuleName);
            customRuleMap.set(customRuleName, customRule);
        });
        const anwser = await inquirer.prompt([
            {
                type: "checkbox",
                name: questionKey,
                message: SELECT_DELETE_CUSTOM_RULE_QUESTION,
                choices: displayList
            }
        ]);
        const ruleToDelete: string[] = anwser[questionKey];
        const transFormedRules: CustomRule[] = ruleToDelete.map(ruleName => customRuleMap.get(ruleName));
        return customRules.filter(customRule => !transFormedRules.includes(customRule));
    }

    private async askEditCustomRuleQuestion(customRules: CustomRule[]): Promise<CustomRule[]> {
        const questionKey = 'questionKey';
        let displayList: string[] = [];
        let customRuleMap: Map<string, CustomRule> = new Map();
        customRules.forEach((customRule, index) => {
            let customRuleName = `${index}:${customRule.Source}->${customRule.Target}:status:${customRule.Status}:contryCode:${customRule.Condition}`;
            displayList.push(customRuleName);
            customRuleMap.set(customRuleName, customRule);
        });
        const anwser = await inquirer.prompt([
            {
                type: "list",
                name: questionKey,
                message: SELECT_EIDT_CUSTOM_RULE_QUESTION,
                choices: displayList
            }
        ]);
        let ruleToUpdate: CustomRule = customRuleMap.get(anwser[questionKey]);
        ruleToUpdate = await this.askNewCustomRuleQuestion(ruleToUpdate);
        return customRules;
    }

    async askWhichBranchToUpdateQuestion(template: CFNTemplate): Promise<string> {
        const questionKey = 'question';
        let branchNames: string[] = this.templateHelper.getBranchesFromTemplate(template);
        if (branchNames.length > 0) {
            if (branchNames.length === 1) {
                return branchNames[0];
            }
            const anwser = await inquirer.prompt([
                {
                    type: "list",
                    name: questionKey,
                    message: PICKUP_FRONTEND_QUESTION,
                    choices: [...branchNames]
                }
            ]);
            return anwser[questionKey];
        }
        return this.askNewBranchName();
    }

    private async askNewBranchName(branches?: string[]): Promise<string> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "input",
                name: questionKey,
                message: ADD_NEW_FRONTEND_QUESTION,
                validate: branchValidator(branches)
            }
        ]);
        return anwser[questionKey];
    }

    async askDeployNowQuestion(envName?: string): Promise<boolean> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "confirm",
                name: questionKey,
                message: getDeployNowQuestion(envName),
                default: true
            }
        ]);
        return anwser[questionKey];
    }

    async askAppIdQuestion(): Promise<string> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "input",
                name: questionKey,
                message: INPUT_APP_ARN_QUESTION
            }
        ]);
        return Utils.getAppIdFromAppArn(anwser[questionKey]);
    }

    private async askConfirmQuestion(message: string): Promise<boolean> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "confirm",
                name: questionKey,
                message: message,
                default: true
            }
        ]);
        return anwser[questionKey];
    }

    async askWhichBranchesToDeleteQuestion(branches: string[]): Promise<string[]> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "checkbox",
                name: questionKey,
                message: SELECT_REMOVE_FRONTEND_QUESTION,
                choices: branches
            }
        ]);
        return anwser[questionKey];
    }

    async askChangeAppIdQuestion(appId: string): Promise<string> {
        const questionKey = 'question';
        const anwser = await inquirer.prompt([
            {
                type: "input",
                name: questionKey,
                message: CHANGE_APP_ARN_QUESTION,
                choices: appId
            }
        ]);
        return anwser[questionKey];
    }

    async askCICDConfirmQuestion() {
        return this.askConfirmQuestion(CICD_CONFIRM_QUESTION);
    }

    async askViewAppQuestion() {
        return this.askConfirmQuestion(VIEW_APP_QUESTION);
    }

    async askViewUrlQuestion() {
        return this.askConfirmQuestion(VIEW_URL_QUESTION);
    }
}

function getDeployNowQuestion(envName?: string): string {
    if (envName) {
        return `Your '${chalk.green(envName)}' frontend will be deployed to an amplifyapp.com domain. Deploy now?`
    } else {
        return `Deploy now?`;
    }
}

function editMessageWithSymbol(input: string, doesEdit: boolean): string {
    const doesMessageContainsSymbol = input.includes(success + ' ');
    const symbolString = success + ' ';
    if (doesMessageContainsSymbol) {
        if (!doesEdit) {
            return input.substring(symbolString.length);
        }
    } else {
        if (doesEdit) {
            return symbolString + input;
        }
    }
    return input;
}

function validateLength(input: string | undefined): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (input) {
            if (input.length <= 0) {
                console.log(chalk.red(INPUT_BLANK_VALIDATION));
                resolve(false);
            } else {
                resolve(true);
            }
        } else {
            console.log(chalk.red(FRONTEND_NAME_VALIDATION));
            resolve(false);
        }
    });
}

function branchValidator(branches?: string[]): (input: string) => Promise<boolean> {
    const validator = (input: string) => new Promise<boolean>((resolve, reject) => {
        if (input) {
            if (input.length <= 0) {
                console.log(chalk.red(INPUT_BLANK_VALIDATION));
                resolve(false);
            } else {
                if (branches && branches.includes(input)) {
                    console.log(chalk.red());
                    resolve(false);
                }
                resolve(true);
            }
        } else {
            console.log(chalk.red(INPUT_BLANK_VALIDATION));
            resolve(false);
        }
    });
    return validator;
}

function validateStatusCode(input: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (typeof (input) === 'number') {
            resolve(true);
        } else {
            console.log(chalk.red(STATUS_CODE_VALIDATION));
            resolve(false);
        }
    })
}