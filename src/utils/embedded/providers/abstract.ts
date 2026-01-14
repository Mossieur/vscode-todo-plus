
/* IMPORT */

import * as _ from 'lodash';
import * as querystring from 'querystring';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import Config from '../../../config';
import EmbeddedView from '../../../views/embedded';
import Folder from '../../folder';
import File from '../../file';
import Markdown from '../markdown';

/* ABSTRACT */

class Abstract {

  include = undefined;
  exclude = undefined;
  rootPaths = undefined;
  filesData = undefined; // { [filePath]: todo[] | undefined }
  watcher: vscode.FileSystemWatcher = undefined;
  markdownSectionCache = new Map<string, { mtimeMs: number; lineMeta: Map<number, MarkdownLineMeta> }>();

  async get ( rootPaths = Folder.getAllRootPaths (), groupByRoot = true, groupByType = true, groupByFile = true, filter: string | false = false, onlyActiveFile: boolean = false ) {

    rootPaths = _.castArray ( rootPaths );

    const config = Config.get ();

    this.include = config.embedded.include;
    this.exclude = config.embedded.exclude;

    if ( !this.filesData || !_.isEqual ( this.rootPaths, rootPaths ) ) {

      this.rootPaths = rootPaths;
      this.unwatchPaths ();
      await this.initFilesData ( rootPaths );
      this.watchPaths ();

    } else {

      await this.updateFilesData ();

    }

    return this.getTodos ( groupByRoot, groupByType, groupByFile, filter, onlyActiveFile );

  }

  async watchPaths () {

    /* HELPERS */

    const pathNormalizer = filePath => filePath.replace ( /\\/g, '/' );

    /* HANDLERS */

    const refresh = _.debounce ( () => EmbeddedView.refresh (), 250 );

    const add = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      if ( this.filesData.hasOwnProperty ( filePath ) ) return;
      if ( !this.isIncluded ( filePath ) ) return;
      this.filesData[filePath] = undefined;
      refresh ();
    };

    const change = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      if ( !this.isIncluded ( filePath ) ) return;
      this.filesData[filePath] = undefined;
      refresh ();
    };

    const unlink = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      delete this.filesData[filePath];
      refresh ();
    };

    /* WATCHING */

    this.include.forEach ( glob => {

      this.watcher = vscode.workspace.createFileSystemWatcher ( glob );

      this.watcher.onDidCreate ( add );
      this.watcher.onDidChange ( change );
      this.watcher.onDidDelete ( unlink );

    });

  }

  unwatchPaths () {

    if ( !this.watcher ) return;

    this.watcher.dispose ();

  }

  getIncluded ( filePaths ) {

    const micromatch = require ( 'micromatch' ); // Lazy import for performance

    return micromatch ( filePaths, this.include, { ignore: this.exclude, dot: true } );

  }

  isIncluded ( filePath ) {

    return !!this.getIncluded ([ filePath ]).length;

  }

  async initFilesData ( rootPaths ) {

    this.filesData = {};

  }

  async updateFilesData () {}

  getTodos ( groupByRoot, groupByType, groupByFile, filter, onlyActiveFile ) {

    if ( _.isEmpty ( this.filesData ) ) return;

    this.addMarkdownSectionTitles ( this.filesData );

    const todos = {}, // { [ROOT] { [TYPE] => { [FILEPATH] => [DATA] } } }
          filterRe = filter ? new RegExp ( _.escapeRegExp ( filter ), 'i' ) : false,
          filePaths = Object.keys ( this.filesData ),
          activeFilePath = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri.fsPath : '';

    filePaths.forEach ( filePath => {
      
      if ( onlyActiveFile && path.normalize ( filePath ) !== path.normalize ( activeFilePath ) ) return;

      const data = this.filesData[filePath];

      if ( !data || !data.length ) return;

      const filePathGroup = groupByFile ? filePath : '';

      data.forEach ( datum => {

        if ( filterRe && !filterRe.test ( datum.line ) && !filterRe.test ( filePath ) ) return;

        const rootGroup = groupByRoot ? datum.root : '';

        if ( !todos[rootGroup] ) todos[rootGroup] = {};

        const typeGroup = groupByType ? datum.type : '';

        if ( !todos[rootGroup][typeGroup] ) todos[rootGroup][typeGroup] = {};

        if ( !todos[rootGroup][typeGroup][filePathGroup] ) todos[rootGroup][typeGroup][filePathGroup] = [];

        todos[rootGroup][typeGroup][filePathGroup].push ( datum );

      });

    });

    const roots = Object.keys ( todos );

    return roots.length > 1 ? todos : { '': todos[roots[0]] };

  }

  renderTodos ( todos ) {

    if ( _.isEmpty ( todos ) ) return '';

    const sepRe = new RegExp ( querystring.escape ( '/' ), 'g' ),
          config = Config.get (),
          { indentation, embedded: { file: { wholeLine } }, symbols: { box } } = config,
          lines = [];

    /* LINES */

    const roots = Object.keys ( todos ).sort ();

    roots.forEach ( root => {

      if ( root ) {
        lines.push ( `\n${root}:` );
      }

      const types = Object.keys ( todos[root] ).sort ( ( a, b ) => {
        if ( a === 'MARKDOWN TASKS ✓' ) return -1;
        if ( b === 'MARKDOWN TASKS ✓' ) return 1;
        return a.localeCompare ( b );
      } );

      types.forEach ( type => {

        if ( type ) {
          lines.push ( `${root ? indentation : '\n'}${type}:` );
        }

        const filePaths = Object.keys ( todos[root][type] ).sort ();

        filePaths.forEach ( filePath => {

          if ( filePath ) {

            const normalizedFilePath = `/${_.trimStart ( filePath, '/' )}`,
                  encodedFilePath = querystring.escape ( normalizedFilePath ).replace ( sepRe, '/' );

            lines.push ( `${root ? indentation : ''}${type ? indentation : ''}@file://${encodedFilePath}` );

          }

          const data = todos[root][type][filePath];

          data.forEach ( datum => {

            const normalizedFilePath = `/${_.trimStart ( datum.filePath, '/' )}`,
                  encodedFilePath = querystring.escape ( normalizedFilePath ).replace ( sepRe, '/' ),
                  label = _.trimStart ( wholeLine ? datum.line : datum.message ),
                  sectionSuffix = ( datum.sectionTitle && !datum.isNested ) ? ` (${datum.sectionTitle})` : '';

            lines.push ( `${root ? indentation : ''}${type ? indentation : ''}${filePath ? indentation : ''}${box} ${label}${sectionSuffix} @file://${encodedFilePath}#${datum.lineNr + 1}` );

          });

        });

      });

    });

    return lines.length ? `${lines.join ( '\n' )}\n` : '';

  }

  addMarkdownSectionTitles ( filesData ) {

    const filePaths = Object.keys ( filesData ),
          indentUnit = Markdown.getIndentUnit ( Config.get ().indentation );

    filePaths.forEach ( filePath => {

      const data = filesData[filePath] as TodoDataArray;

      if ( !data || !data.length ) return;
      if ( path.extname ( filePath ).toLowerCase () !== '.md' ) return;

      const todosToUpdate = data.filter ( datum => datum.type === 'MARKDOWN TASKS ✓' );

      if ( !todosToUpdate.length ) return;

      const lineToTodos = new Map<number, any[]> ();

      todosToUpdate.forEach ( datum => {
        if ( !lineToTodos.has ( datum.lineNr ) ) lineToTodos.set ( datum.lineNr, [] );
        lineToTodos.get ( datum.lineNr ).push ( datum );
      } );

      const fileMeta = this.getMarkdownLineMeta ( filePath, lineToTodos, indentUnit );

      if ( !fileMeta ) return;

      this.applyMarkdownLineMeta ( todosToUpdate, fileMeta );

    } );

  }

  getMarkdownLineMeta ( filePath, lineToTodos, indentUnit ) {

    const stat = this.getFileStat ( filePath );

    if ( !stat ) return;

    const cached = this.markdownSectionCache.get ( filePath );

    if ( cached && cached.mtimeMs === stat.mtimeMs ) return cached.lineMeta;

    const content = File.readSync ( filePath );

    if ( !content ) return;

    const lines = content.split ( /\r?\n/ ),
          lineMeta = new Map<number, MarkdownLineMeta> ();

    let currentSection = '',
        inCodeFence = false;

    const baseIndentBySection = new Map<string, number> ();

    lines.forEach ( ( line, lineNr ) => {

      if ( Markdown.isCodeFence ( line ) ) {
        inCodeFence = !inCodeFence;
      }

      if ( !inCodeFence ) {
        const headingTitle = Markdown.getHeadingTitle ( line );
        if ( headingTitle ) currentSection = headingTitle;
      }

      if ( !lineToTodos.has ( lineNr ) ) return;

      if ( !currentSection ) {
        lineMeta.set ( lineNr, { sectionTitle: undefined, isNested: false } );
        return;
      }

      const indentWidth = Markdown.getIndentWidth ( line, indentUnit ),
            baseIndent = baseIndentBySection.get ( currentSection );

      if ( _.isUndefined ( baseIndent ) || indentWidth <= baseIndent ) {
        baseIndentBySection.set ( currentSection, indentWidth );
        lineMeta.set ( lineNr, { sectionTitle: currentSection, isNested: false } );
      } else {
        lineMeta.set ( lineNr, { sectionTitle: currentSection, isNested: true } );
      }

    } );

    this.markdownSectionCache.set ( filePath, { mtimeMs: stat.mtimeMs, lineMeta } );

    return lineMeta;

  }

  applyMarkdownLineMeta ( todos, lineMeta ) {

    todos.forEach ( datum => {
      const meta = lineMeta.get ( datum.lineNr );
      datum.sectionTitle = meta ? meta.sectionTitle : undefined;
      datum.isNested = meta ? meta.isNested : false;
    } );

  }

  getFileStat ( filePath ) {

    try {
      return fs.statSync ( filePath );
    } catch ( e ) {
      return;
    }

  }

}

type TodoDataArray = Array<any>;

type MarkdownLineMeta = {
  sectionTitle?: string;
  isNested: boolean;
};

/* EXPORT */

export default Abstract;
