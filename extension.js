const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    let build = vscode.commands.registerCommand(
        "extension.buildCodeqlDbInManual",
        async function (uri) {
            await buildCodeqlDb(uri, true);
        }
    );
    
    let nobuild = vscode.commands.registerCommand(
        "extension.buildCodeqlDb",
        async function (uri) {
            await buildCodeqlDb(uri, false);
        }
    );
    
    async function buildCodeqlDb(uri, includeCommand = true) {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage("No folder path available.");
            return;
        }
    
        const languageOptions = [
            { label: 'Java', description: 'Select Java as your main language', value: 'java' },
            { label: 'JavaScript/TypeScript', description: 'Select JavaScript/TypeScript as your main language', value: 'javascript' }
        ];
    
        const language = await vscode.window.showQuickPick(languageOptions, {
            placeHolder: 'Select a language for your code'
        });
    
        if (!language) return;
    
        const command = includeCommand ? await vscode.window.showInputBox({
            prompt: "Enter your build command"
        }) : undefined;
        await updateDb(language.value, uri.fsPath, command);
    }    

    context.subscriptions.push(build, nobuild);
}

function deactivate() { }

async function updateDb(language, sourceRoot, command) {
    // Cleanup old database with sanitized path
    await cleanupOldDb(sourceRoot);

    let database = await sanitizePath(path.join(sourceRoot, "sample_" + Date.now()));
    let cmd;
    if (command) {
        cmd = `codeql database create ${database} --language=${language} --source-root ${sourceRoot} --command ${command} --overwrite`;
    } else {
        cmd = `codeql database create ${database} --language=${language} --source-root ${sourceRoot} --build-mode=none --overwrite`;
    }

    try {
        await codeqlCmd(cmd).then(() => loadDatabase(database));
    } catch (error) {
        console.error('Error occurred during database update:', error.message);
    }
}

async function cleanupOldDb(folderPath) {
    try {
        const sanitizedFolderPath = await sanitizePath(folderPath);
        const files = await fs.promises.readdir(sanitizedFolderPath);
        const totalFiles = files.length;
        let processedFiles = 0;

        // Show progress bar
        const progressOptions = { location: vscode.ProgressLocation.Notification, title: "Cleaning up old databases" };
        await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ increment: 0 });

            for (const file of files) {
                const curPath = path.join(sanitizedFolderPath, file);
                const curStat = await fs.promises.lstat(curPath);

                if (curStat.isDirectory() && file.startsWith("sample_")) {
                    await cleanupDbFolder(curPath);
                }

                // Update progress
                processedFiles++;
                const percentage = (processedFiles / totalFiles) * 100;
                progress.report({ increment: percentage });
            }
        });
    } catch (err) {
        console.error("Error cleaning up database folder:", err);
    }
}

async function cleanupDbFolder(folderPath) {
    try {
        const files = await fs.promises.readdir(folderPath);
        for (const file of files) {
            const curPath = await sanitizePath(path.join(folderPath, file));
            const curStat = await fs.promises.lstat(curPath);

            if (curStat.isDirectory()) {
                await cleanupDbFolder(curPath);
            } else {
                await fs.promises.unlink(curPath);
            }
        }
        await fs.promises.rmdir(folderPath);
    } catch (err) {
        console.error("Error cleaning up database subfolder:", err);
    }
}

async function codeqlCmd(cmd) {
    const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: "Creating CodeQL database"
    };

    try {
        const progress = await vscode.window.withProgress(progressOptions, async (progress) => {
            progress.report({ increment: 0, message: "Starting CodeQL database creation" });

            const child = child_process.spawn(cmd, { shell: true });

            child.stderr.on('data', (data) => {
                console.log(data.toString());
                progress.report({ increment: 2, message: data.toString() });
            });

            child.stdout.on('data', (data) => {
                console.log(data.toString());
                progress.report({ increment: 1, message: data.toString() });
            });

            await new Promise((resolve, reject) => {
                child.on('exit', (code, signal) => {
                    console.log(`exit ${code} ${signal}`);
                    if (code != 0) {
                        reject(new Error(`Command failed with code ${code}: ${stderr}`));
                    }
                    progress.report({ increment: 100, message: "CodeQL database creation completed." });
                    resolve();
                });

                child.on('error', (error) => {
                    console.log(error);
                    reject(error);
                });
            });
        });

    } catch (err) {
        console.log(err);
    }
}


async function sanitizePath(inputPath) {
    const absolutePath = path.resolve(inputPath);
    if (path.isAbsolute(inputPath) && inputPath === absolutePath) {
        return absolutePath;
    } else {
        throw new Error('Invalid path');
    }
}

async function loadDatabase(databasePath) {
    await vscode.commands.executeCommand("codeQL.setCurrentDatabase", vscode.Uri.file(databasePath));
    vscode.window.showInformationMessage("Finished building CodeQL database and set it as current database for analyzing.");
}

module.exports = {
    activate,
    deactivate,
};
