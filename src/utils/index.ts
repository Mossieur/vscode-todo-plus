
/* IMPORT */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import ackmate from './ackmate';
import archive from './archive';
import ast from './ast';
import command from './command';
import editor from './editor';
import embedded from './embedded';
import file from './file';
import files from './files';
import folder from './folder';
import init from './init';
import regex from './regex';
import time from './time';
import todo from './todo';
import statistics from './statistics';
import view from './view';

/* UTILS */

const Utils = {
  context: <vscode.ExtensionContext> undefined,
  extension: <vscode.Extension<any>> undefined,
  setExtensionInfo ( context: vscode.ExtensionContext ) {
    Utils.context = context;
    const packagePath = path.join ( context.extensionPath, 'package.json' );
    const packageJSON = JSON.parse ( fs.readFileSync ( packagePath, 'utf8' ) ),
          publisher = packageJSON && packageJSON.publisher,
          name = packageJSON && packageJSON.name,
          extensionId = publisher && name ? `${publisher}.${name}` : '';

    Utils.extension = extensionId ? vscode.extensions.getExtension ( extensionId ) : undefined;
  },
  ackmate,
  archive,
  ast,
  command,
  editor,
  embedded,
  file,
  files,
  folder,
  init,
  regex,
  time,
  todo,
  statistics,
  view
};

/* EXPORT */

export default Utils;
