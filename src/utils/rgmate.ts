/* IMPORT */

import * as _ from 'lodash';

/* RGMATE */

const RGmate = {

  newLineRe: /\r?\n/g,
  matchLineRe: /^(.*?):(\d+):(\d+):(.*)$/,

  normalizePath ( filePath ) {

    return filePath.replace ( /\\/g, '/' );

  },

  parse ( str ) {

    const lines = str.split ( RGmate.newLineRe );

    return _.compact ( lines.map ( line => {

      const match = line.match ( RGmate.matchLineRe );

      if ( !match ) return;

      return {
        filePath: RGmate.normalizePath ( match[1] ),
        lineNr: parseInt ( match[2], 10 ) - 1, // 0-index
        line: match[4]
      };

    }));

  }

};

/* EXPORT */

export default RGmate;
