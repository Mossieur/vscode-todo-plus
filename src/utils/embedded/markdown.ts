/* MARKDOWN */

const headingRe = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const codeFenceRe = /^\s*(```|~~~)/;
const leadingWhitespaceRe = /^\s*/;

const Markdown = {

  getIndentUnit ( indentation ) {

    if ( typeof indentation !== 'string' || !indentation.length ) return '  ';

    return indentation;

  },

  getHeadingTitle ( line: string ) {

    const match = line.match ( headingRe );

    if ( !match ) return;

    return `${match[1]} ${match[2].trim ()}`;

  },

  getDisplayHeadingTitle ( title: string ) {

    return title.replace ( /^\s*#{1,6}\s+/, '' ).trim ();

  },

  getIndentWidth ( line: string, indentUnit: string ) {

    const leading = ( line.match ( leadingWhitespaceRe ) || [''] )[0],
          expanded = leading.replace ( /\t/g, indentUnit );

    return expanded.length;

  },

  isCodeFence ( line: string ) {

    return codeFenceRe.test ( line );

  }

};

/* EXPORT */

export default Markdown;
