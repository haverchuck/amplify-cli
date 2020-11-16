import * as fs from 'fs-extra';
import * as path from 'path';
import {
  initJSProjectWithProfile,
  initFlutterProjectWithProfile,
  deleteProject,
  amplifyPushAuth,
  amplifyPush,
} from 'amplify-e2e-core';
import {
  addAuthWithDefault,
  runAmplifyAuthConsole,
  removeAuthWithDefault,
  addAuthWithDefaultSocial,
  addAuthWithGroupTrigger,
  addAuthWithRecaptchaTrigger,
  addAuthViaAPIWithTrigger,
} from 'amplify-e2e-core';
import {
  createNewProjectDir,
  deleteProjectDir,
  getProjectMeta,
  getUserPool,
  getUserPoolClients,
  getLambdaFunction,
} from 'amplify-e2e-core';

const defaultsSettings = {
  name: 'authTest',
};

describe('amplify add auth...', () => {
  let projRoot: string;
  beforeEach(async () => {
    projRoot = await createNewProjectDir('auth');
  });

  afterEach(async () => {
    await deleteProject(projRoot);
    deleteProjectDir(projRoot);
  });

  it('...should init a project and add auth with defaults', async () => {
    await initJSProjectWithProfile(projRoot, defaultsSettings);
    await addAuthWithDefault(projRoot, {});
    await amplifyPushAuth(projRoot);
    await runAmplifyAuthConsole(projRoot);
    const meta = getProjectMeta(projRoot);
    const id = Object.keys(meta.auth).map(key => meta.auth[key])[0].output.UserPoolId;
    const userPool = await getUserPool(id, meta.providers.awscloudformation.Region);
    expect(userPool.UserPool).toBeDefined();
  });

  it('should init with a long env name and add default auth', async () => {
    await initJSProjectWithProfile(projRoot, { ...defaultsSettings, envName: 'longenviro' });
    await addAuthWithDefault(projRoot, {});
    await amplifyPushAuth(projRoot);
    const meta = getProjectMeta(projRoot);
    const id = Object.keys(meta.auth).map(key => meta.auth[key])[0].output.UserPoolId;
    const userPool = await getUserPool(id, meta.providers.awscloudformation.Region);
    expect(userPool.UserPool).toBeDefined();
  });
});
