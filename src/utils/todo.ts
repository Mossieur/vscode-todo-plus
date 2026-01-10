
/* IMPORT */

import * as _ from 'lodash';
import * as path from 'path';
import Config from '../config';
import File from './file';
import Utils from './index';

/* TODO */

const Todo = {

  getFiles ( folderPath ) {

    const config = Config.get (),
          extension = Utils.extension,
          packageJSON = extension && extension.packageJSON,
          contributes = packageJSON && packageJSON.contributes,
          languages = contributes && contributes.languages,
          extensions = ( languages && languages[0] && languages[0].extensions ) || [],
          files = _.uniq ([ config.file.name, ...extensions ]);

    return files.map ( file => path.join ( folderPath, file ) );

  },

  get ( folderPath ) {

    const files = Todo.getFiles ( folderPath );

    for ( let file of files ) {

      const content = File.readSync ( file );

      if ( _.isUndefined ( content ) ) continue;

      return {
        path: file,
        content
      };

    }

  }

};

/* EXPORT */

export default Todo;
