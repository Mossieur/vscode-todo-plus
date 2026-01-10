
/* IMPORT */

import * as vscode from 'vscode';
import beggar from 'vscode-beggar';
import Config from './config';
import Consts from './consts';
import CompletionProvider from './providers/completion';
import SymbolsProvider from './providers/symbols';
import DocumentDecorator from './todo/decorators/document';
import ChangesDecorator from './todo/decorators/changes';
import Utils from './utils';
import ViewEmbedded from './views/embedded';
import ViewFiles from './views/files';

/* ACTIVATE */

const activate = function ( context: vscode.ExtensionContext ) {

  Utils.setExtensionInfo ( context );
  const extension = Utils.extension,
        packageJSON = extension && extension.packageJSON,
        extensionName = packageJSON && packageJSON.name;

  if ( !extensionName ) {
    console.warn ( 'Todo+ extension metadata unavailable; activation aborted.' );
    return;
  }

  beggar ({
    id: extensionName,
    title: '𝗧𝗼𝗱𝗼+ - 𝗙𝘂𝗻𝗱𝗿𝗮𝗶𝘀𝗶𝗻𝗴 𝗔𝗻𝗻𝗼𝘂𝗻𝗰𝗲𝗺𝗲𝗻𝘁: We are collecting some money to allow for further development, if you find this extension useful please please please consider donating to it and be part of something amazing!',
    url: 'https://buy.stripe.com/4gweWHcsh71lbN6dQQ',
    actions: {
      yes: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22${extensionName}%22%2C%22result%22%3A1%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      },
      no: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22${extensionName}%22%2C%22result%22%3A0%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      },
      cancel: {
        webhook: `https://telemetry.notable.app/track?events=%5B%7B%22event%22%3A%22vscode-beggar%22%2C%22extension%22%3A%22${extensionName}%22%2C%22result%22%3A2%2C%22timestamp%22%3A${Date.now ()}%7D%5D`
      }
    }
  });

  const config = Config.get ();

  Config.check ( config );

  ViewEmbedded.expanded = config.embedded.view.expanded;

  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', ViewEmbedded.expanded );
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered', !!ViewEmbedded.filter );

  ViewEmbedded.all = true;

  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-all', !!ViewEmbedded.all );

  ViewFiles.expanded = config.file.view.expanded;

  vscode.commands.executeCommand ( 'setContext', 'todo-files-expanded', ViewFiles.expanded );
  vscode.commands.executeCommand ( 'setContext', 'todo-files-open-button', true );

  Utils.folder.initRootsRe ();
  Utils.init.language ();
  Utils.init.views ();
  Utils.statistics.tokens.updateDisabledAll ();

  context.subscriptions.push (
    vscode.languages.registerCompletionItemProvider ( Consts.languageId, new CompletionProvider (), ...CompletionProvider.triggerCharacters ),
    vscode.languages.registerDocumentSymbolProvider ( Consts.languageId, new SymbolsProvider () ),
    vscode.window.onDidChangeActiveTextEditor ( () => DocumentDecorator.update () ),
    vscode.workspace.onDidChangeConfiguration ( Consts.update ),
    vscode.workspace.onDidChangeConfiguration ( () => delete Utils.files.filesData && Utils.embedded.provider && delete Utils.embedded.provider.filesData ),
    vscode.workspace.onDidChangeConfiguration ( () => DocumentDecorator.update () ),
    vscode.workspace.onDidChangeConfiguration ( Utils.statistics.tokens.updateDisabledAll ),
    vscode.workspace.onDidChangeTextDocument ( ChangesDecorator.onChanges ),
    vscode.workspace.onDidChangeWorkspaceFolders ( () => Utils.embedded.provider && Utils.embedded.provider.unwatchPaths () ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.files.unwatchPaths ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.folder.initRootsRe )
  );

  DocumentDecorator.update ();

  return Utils.init.commands ( context );

};

/* EXPORT */

export {activate};
