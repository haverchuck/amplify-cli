import * as fs from 'fs-extra';
import archiver from 'archiver';
import * as path from 'path';
import ora from 'ora';

const DIR_NOT_FOUND_ERROR_MESSAGE = 'Please ensure your build path exist';
const ZIPPING_MESSAGE = 'Zipping artifacts.. ';
const ZIPPING_SUCCESS_MESSAGE = 'Zipping artifacts completed.';
const ZIPPING_FAILURE_MESSAGE = 'Zipping artifacts failed.';

function zipFile(sourceDir: string, destDir: string): Promise<string> {
    return new Promise( (resolve, reject) => {
        const spinner = ora();
        if (!fs.pathExistsSync(sourceDir)) {
            reject(DIR_NOT_FOUND_ERROR_MESSAGE);
        }
        spinner.start(ZIPPING_MESSAGE);
        const now = new Date();
        const zipFilePath = path.join(destDir, `${now.getTime()}.zip`);
        let output = fs.createWriteStream(zipFilePath);
        let archive = archiver('zip');
        output.on('close', function () {
            spinner.succeed(ZIPPING_SUCCESS_MESSAGE);
            resolve(zipFilePath);
        });
        archive.on('error', function (err: archiver.ArchiverError) {
            spinner.fail(ZIPPING_FAILURE_MESSAGE);
            reject(err);
        });
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}



function getAppIdFromAppArn(appArn: string): string {
    const arnList: string[] = appArn.split('/');
    if (arnList.length !== 2) {
        throw new Error('Invalid App Arn');
    }
    return arnList[1];
}


export {
    zipFile,
    getAppIdFromAppArn
}