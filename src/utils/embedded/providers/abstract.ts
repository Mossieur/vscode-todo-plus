
/* IMPORT */

import * as _ from 'lodash';
import * as querystring from 'querystring';
import * as path from 'path';
import * as vscode from 'vscode';
import Config from '../../../config';
import EmbeddedView from '../../../views/embedded';
import Folder from '../../folder';
import File from '../../file';

/* ABSTRACT */

class Abstract {

  include = undefined;
  exclude = undefined;
  rootPaths = undefined;
  filesData = undefined; // { [filePath]: todo[] | undefined }
  watcher: vscode.FileSystemWatcher = undefined;

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

    const filePaths = Object.keys ( filesData );

    filePaths.forEach ( filePath => {

      const data = filesData[filePath];

      if ( !data || !data.length ) return;
      if ( path.extname ( filePath ).toLowerCase () !== '.md' ) return;

      const todosToUpdate = data.filter ( datum => datum.type === 'MARKDOWN TASKS ✓' );

      if ( !todosToUpdate.length ) return;

      const content = File.readSync ( filePath );

      if ( !content ) return;

      const lines = content.split ( /\r?\n/ ),
            lineToTodos = new Map<number, any[]> ();

      todosToUpdate.forEach ( datum => {
        datum.sectionTitle = undefined;
        datum.isNested = false;
        if ( !lineToTodos.has ( datum.lineNr ) ) lineToTodos.set ( datum.lineNr, [] );
        lineToTodos.get ( datum.lineNr ).push ( datum );
      } );

      let currentSection = '',
          inCodeFence = false;

      const baseIndentBySection = new Map<string, number> (),
            indentUnit = this.getIndentUnit ( Config.get ().indentation );

      lines.forEach ( ( line, lineNr ) => {

        if ( /^\s*(```|~~~)/.test ( line ) ) {
          inCodeFence = !inCodeFence;
        }

        if ( !inCodeFence ) {
          const headingMatch = line.match ( /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/ );
          if ( headingMatch ) currentSection = `${headingMatch[1]} ${headingMatch[2].trim ()}`;
        }

        const todosAtLine = lineToTodos.get ( lineNr );
        if ( !todosAtLine ) return;

        if ( !currentSection ) {
          todosAtLine.forEach ( datum => {
            datum.sectionTitle = undefined;
            datum.isNested = false;
          } );
          return;
        }

        const leading = line.match ( /^\s*/ )[0],
              expanded = leading.replace ( /\t/g, indentUnit ),
              indentWidth = expanded.length,
              baseIndent = baseIndentBySection.get ( currentSection );

        if ( _.isUndefined ( baseIndent ) || indentWidth <= baseIndent ) {
          baseIndentBySection.set ( currentSection, indentWidth );
          todosAtLine.forEach ( datum => {
            datum.sectionTitle = currentSection;
            datum.isNested = false;
          } );
        } else {
          todosAtLine.forEach ( datum => {
            datum.sectionTitle = currentSection;
            datum.isNested = true;
          } );
        }

      } );

    } );

  }

  getIndentUnit ( indentation ) {

    if ( typeof indentation !== 'string' || !indentation.length ) return '  ';

    return indentation;

  }

}

/* EXPORT */

export default Abstract;
