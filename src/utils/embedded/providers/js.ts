
/* IMPORT */

import * as _ from 'lodash';
import stringMatches from 'string-matches';
import Consts from '../../../consts';
import File from '../../file';
import Folder from '../../folder';
import Abstract from './abstract';

/* JS */

class JS extends Abstract {

  async getFilePaths ( rootPaths ) {

    const globby = require ( 'globby' ); // Lazy import for performance

    return _.flatten ( await Promise.all ( rootPaths.map ( cwd => globby ( this.include, { cwd, ignore: this.exclude, dot: true, absolute: true } ) ) ) );

  }

  async initFilesData ( rootPaths ) {

    const filePaths = await this.getFilePaths ( rootPaths );

    this.filesData = {};

    await Promise.all ( filePaths.map ( async ( filePath: string ) => {

      this.filesData[filePath] = await this.getFileData ( filePath );

    }));

  }

  async updateFilesData () {

    if ( _.isEmpty ( this.filesData ) ) return;

    await Promise.all ( _.map ( this.filesData, async ( val, filePath ) => {

      if ( val ) return;

      this.filesData[filePath] = await this.getFileData ( filePath );

    }));

  }

  async getFileData ( filePath ) {

    const data = [],
          content = await File.read ( filePath );

    if ( !content ) return data;

    const lines = content.split ( /\r?\n/ );

    let parsedPath;

    lines.forEach ( ( rawLine, lineNr ) => {

      const line = _.trimStart ( rawLine ),
            matches = stringMatches ( line, Consts.regexes.todoEmbedded );

      if ( !matches.length ) return;

      if ( !parsedPath ) {

        parsedPath = Folder.parsePath ( filePath );

      }

      matches.forEach(match => {

        const rawType = match[1],
          upperType = rawType ? rawType.toUpperCase() : '',
          type = (upperType === '- [ ]' || upperType === '* [ ]' || upperType === '+ [ ]') ? 'MARKDOWN TASKS ✓' : upperType;

        data.push({
          todo: match[0],
          type,
          message: match[2],
          code: line.slice(0, line.indexOf(match[0])),
          rawLine,
          line,
          lineNr,
          filePath,
          root: parsedPath.root,
          rootPath: parsedPath.rootPath,
          relativePath: parsedPath.relativePath
        });

      });

    });

    return data;

  }

};

/* EXPORT */

export default JS;
