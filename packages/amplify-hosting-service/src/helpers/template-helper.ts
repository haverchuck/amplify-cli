import { AmplifyContext, CFNParameters, CFNTemplate, BranchTemplate } from '../types';
import { PathHelper, CommonHelper, StackHelper } from './index';
import * as fs from 'fs-extra';
import defaultTemplate from '../templates/template.json';
import defaultBranchTemplate from '../templates/branch-template.json';
import { AMPLIFY_APP_LOGIC_ID } from '../constants';

type BranchesToChange = {
    branchesToDelete: string [];
    branchesToCreate: string [];
}

export class TemplateHelper {
    private context: AmplifyContext;
    private pathHelper: PathHelper;
    private commonHelper: CommonHelper;
    private templatePath: string;
    private stackHelper: StackHelper;

    constructor(context: AmplifyContext) {
        this.context = context;
        this.pathHelper = new PathHelper(context);
        this.commonHelper = new CommonHelper(context);
        this.stackHelper = new StackHelper(context);
        this.templatePath = this.pathHelper.getCFNTemplatePath();
    }

    async generateTemplate(stackName: string, parameters?: CFNParameters): Promise<CFNTemplate> {
        let template: CFNTemplate = this.initTemplate();
        let cloudTemplate: CFNTemplate = await this.stackHelper.getStackTemplate(stackName);
        if (cloudTemplate) {
            template.Resources = { ...cloudTemplate.Resources, ...template.Resources };
        }
        if (parameters) {
            this.updateTemplate(template, parameters);
        }
        return template;
    }

    getBranchesFromTemplate(template: CFNTemplate): string[] {
        return Object.keys(template.Resources).filter(branchName => branchName !== AMPLIFY_APP_LOGIC_ID);
    }

    initTemplate(): CFNTemplate {
        if (fs.existsSync(this.templatePath)) {
            // load template
            return fs.readJSONSync(this.templatePath);
        } else {
            //generate new template
            let newTemplate = { ...defaultTemplate };
            this.updateTemplate(newTemplate, {
                Name: this.commonHelper.getDefaultProjectName()
            });
            return newTemplate;
        }
    }

    doesTemplateExist(): boolean {
        return fs.existsSync(this.templatePath);
    }

    getParametersFromTemplate(template: CFNTemplate): CFNParameters {
        return { ...template.Resources.AmplifyApp.Properties };
    }

    updateTemplate(template: CFNTemplate, parameters: CFNParameters) {
        if (parameters.BranchesAfterEdit) {
            const branchesToChange: BranchesToChange = caculateBranchesToChange(parameters.Branches, parameters.BranchesAfterEdit);
            for (const branchToDelete of branchesToChange.branchesToDelete) {
                this.deleteBranchFromTemplate(template, branchToDelete);
            }

            for (const branchToCreate of branchesToChange.branchesToCreate) {
                this.addBranchToTemplate(template, branchToCreate);
            }
        }
        Object.keys(parameters).forEach(key => {
            if (parameters[key]) {
                if (key !== 'BranchesAfterEdit' && key !== 'Branches') {
                    template.Resources.AmplifyApp.Properties[key] = parameters[key];
                }
            }
        });
    }

    deleteBranchFromTemplate(template: CFNTemplate, branchName: string): void {
        if (template.Resources[branchName]) {
            template.Resources[branchName] = undefined;
        }
    }

    addBranchToTemplate(template: CFNTemplate, branchName: string): void {
        let branchTemplate: BranchTemplate;
        if (template.Resources[branchName]) {
            branchTemplate = template.Resources[branchName];
        } else {
            defaultBranchTemplate.Properties.BranchName = branchName;
            branchTemplate = defaultBranchTemplate;
        }
        template.Resources[branchName] = branchTemplate;
    }

    writeAppTemplate(template: CFNTemplate) {
        let appTemplate = { ...template };
        appTemplate.Resources = {
            AmplifyApp: template.Resources.AmplifyApp
        }
        let jsonString = JSON.stringify(appTemplate, null, 4);
        fs.writeFileSync(this.templatePath, jsonString, 'utf8');

    }

    loadTemplate(): CFNTemplate {
        return this.context.amplify.readJsonFile(this.templatePath);
    }
}

function caculateBranchesToChange(currentBranches: string[], branchesAfterEdit: string[]): BranchesToChange {
    let branchesToChange: BranchesToChange = {
        branchesToCreate: [],
        branchesToDelete: []
    };
    for (const currentBranch of currentBranches) {
        if (!branchesAfterEdit.includes(currentBranch)) {
            branchesToChange.branchesToDelete.push(currentBranch);
        }
    };
    for (const branchAfterEdit of branchesAfterEdit) {
        if (!currentBranches.includes(branchAfterEdit)) {
            branchesToChange.branchesToCreate.push(branchAfterEdit);
        }
    }
    return branchesToChange;
}




