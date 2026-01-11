
/* IMPORT */

import * as vscode from 'vscode';
import Utils from '../../utils';
import Item from './item';

/* GROUP */

class Group extends Item {

  contextValue = 'group';

  constructor ( obj, label, icon = false ) {

    super ( obj, label, vscode.TreeItemCollapsibleState.Expanded );

    if ( icon ) {

      const type = label.toUpperCase ();

      if ( type === 'MARKDOWN TASKS ✓' ) {
        this.iconPath = Utils.view.getMarkdownIcon ( 'logo' );
      } else {
        this.setTypeIcon ( type );
      }

      if ( this.iconPath ) {

        this.label = type;

      }

    }

  }

}

/* EXPORT */

export default Group;
