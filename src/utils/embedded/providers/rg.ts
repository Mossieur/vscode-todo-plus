
/* IMPORT */

import * as execa from 'execa';
import Config from '../../../config';
import AG from './ag';
import RGmate from '../../rgmate';

/* RG */ // ripgrep //URL: https://github.com/BurntSushi/ripgrep

class RG extends AG {

  static bin = 'rg';

  execa ( filePaths ) {

    const config = Config.get ();

    return execa ( RG.bin, ['--color', 'never', '--vimgrep', ...config.embedded.providers.rg.args, config.embedded.providers.rg.regex, ...filePaths], { reject: false } );

  }

  async getAckmate ( filePaths ) {

    filePaths = [].concat ( filePaths || [] );

    if ( !filePaths.length ) return [];

    try {

      const {stdout} = await this.execa ( filePaths );

      return stdout ? RGmate.parse ( stdout ) : [];

    } catch ( e ) {

      console.log ( e );

      return [];

    }

  }

}

/* EXPORT */

export default RG;
