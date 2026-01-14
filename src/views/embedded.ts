
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import * as path from 'path';
import Utils from '../utils';
import Markdown from '../utils/embedded/markdown';
import File from './items/file';
import Item from './items/item';
import Group from './items/group';
import Placeholder from './items/placeholder';
import Todo from './items/todo';
import View from './view';

/* EMBEDDED */

//TODO: Collapse/Expand without rebuilding the tree https://github.com/Microsoft/vscode/issues/54192

class Embedded extends View {

  id = 'todo.views.2embedded';
  all = true;
  clear = false;
  expanded = true;
  filter: string | false = false;
  filePathRe = /^(?!~).*(?:\\|\/)/;

  constructor () {

    super ();

    vscode.window.onDidChangeActiveTextEditor ( ()  => {
      if ( this.all ) return;
      this.refresh ();
    });

  }

  getTreeItem ( item: Item ): vscode.TreeItem {

    if ( item.contextValue === 'sectionGroup' ) {
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    }

    if ( item.collapsibleState !== vscode.TreeItemCollapsibleState.None ) {
      item.collapsibleState = this.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
    }

    return item;

  }

  async getEmbedded () {

    await Utils.embedded.initProvider ();

    return await Utils.embedded.provider.get ( undefined, this.config.embedded.view.groupByRoot, this.config.embedded.view.groupByType, this.config.embedded.view.groupByFile, this.filter, !this.all );

  }

  async getChildren ( item?: Item ): Promise<Item[]> {

    if ( this.clear ) {

      setTimeout ( this.refresh.bind ( this ), 0 );

      return [];

    }

    let obj = item ? item.obj : await this.getEmbedded ();

    if ( item && _.isArray ( item.obj.children ) ) {
      const childTodos = this.asTodoDataArray ( item.obj.children );
      childTodos.fromNested = true;
      obj = childTodos;
    }

    while ( obj && '' in obj ) obj = obj['']; // Collapsing unnecessary groups

    if ( _.isEmpty ( obj ) ) return [new Placeholder ( 'No embedded todos found' )];

    if ( _.isArray ( obj ) ) {

      return this.getTodoItems ( this.asTodoDataArray ( obj ) );

    } else if ( _.isObject ( obj ) ) {

      const keys = Object.keys ( obj ).sort ( ( a, b ) => {
        const isFileA = this.filePathRe.test ( a ),
              isFileB = this.filePathRe.test ( b );

        if ( isFileA || isFileB ) return a.localeCompare ( b );
        if ( a === 'MARKDOWN TASKS ✓' ) return -1;
        if ( b === 'MARKDOWN TASKS ✓' ) return 1;

        return a.localeCompare ( b );
      } );

      return keys.map ( key => {

        const val = obj[key];

        if ( this.filePathRe.test ( key ) ) {

          const uri = Utils.view.getURI ( val[0] );

          return new File ( val, uri );

        } else {

          return new Group ( val, key, this.config.embedded.view.icons );

        }

      });

    }

  }

  refresh ( clear? ) {

    this.clear = !!clear;

    super.refresh ();

  }

  getTodoItems ( data: TodoDataArray ) {

    const sectionGroups = this.getMarkdownSectionGroups ( data );

    if ( sectionGroups ) return sectionGroups;

    const hasNestedChildren = data.some ( todo => _.isArray ( todo.children ) ),
          addSectionSuffix = !data.sectionGrouped,
          shouldNestMarkdown = !hasNestedChildren && this.shouldNestMarkdownTodos ( data ),
          todoData = shouldNestMarkdown ? this.buildMarkdownTodoTree ( data ) : data,
          todos = todoData.map ( obj => {

            const label = this.getTodoLabel ( obj, addSectionSuffix ),
                  item = new Todo ( obj, label, this.config.embedded.view.icons );

            if ( _.isArray ( obj.children ) && obj.children.length ) {
              item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            }

            return item;

          } );

    if ( this.config.embedded.view.sortBy === 'label' ) this.sortTodosByLabel ( todos );

    return todos;

  }

  getMarkdownSectionGroups ( data: TodoDataArray ) {

    if ( data.sectionGrouped || data.fromNested ) return;
    if ( !data.length ) return;
    if ( !data.every ( todo => todo && todo.type === 'MARKDOWN TASKS ✓' ) ) return;
    if ( !data.every ( todo => todo.sectionTitle ) ) return;

    const sections = [],
          sectionMap = new Map<string, TodoDataArray> ();

    data.forEach ( todo => {
      const title = todo.sectionTitle;
      if ( !title ) return;
      if ( !sectionMap.has ( title ) ) {
        sectionMap.set ( title, this.asTodoDataArray ( [] ) );
        sections.push ( title );
      }
      sectionMap.get ( title ).push ( todo );
    } );

    if ( !sections.length ) return;

    return sections.map ( title => {
      const sectionTodos = sectionMap.get ( title );
      sectionTodos.sectionGrouped = true;
      const displayTitle = Markdown.getDisplayHeadingTitle ( title ),
            group = new Group ( sectionTodos, displayTitle, false );
      group.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      group.contextValue = 'sectionGroup';
      return group;
    } );

  }

  asTodoDataArray ( data: any[] ) {

    return data as TodoDataArray;

  }

  getTodoLabel ( obj, addSectionSuffix: boolean ) {

    const label = this.config.embedded.view.wholeLine ? obj.line : obj.message || obj.todo,
          sectionSuffix = ( addSectionSuffix && obj.sectionTitle && !obj.isNested ) ? ` (${obj.sectionTitle})` : '';

    return `${label}${sectionSuffix}`;

  }

  sortTodosByLabel ( todos ) {

    todos.sort ( ( a, b ) => {

      return a.label.toString ().localeCompare ( b.label.toString () );

    });

  }

  shouldNestMarkdownTodos ( data ) {

    if ( !data.length ) return false;

    if ( !data.every ( todo => todo && todo.type === 'MARKDOWN TASKS ✓' ) ) return false;

    const filePath = data[0].filePath;

    if ( !filePath || !data.every ( todo => todo.filePath === filePath ) ) return false;

    return path.extname ( filePath ).toLowerCase () === '.md';

  }

  buildMarkdownTodoTree ( data ) {

    const indentUnit = Markdown.getIndentUnit ( this.config.indentation ),
          indentUnitLength = indentUnit.length,
          levels = data.map ( todo => {
            const rawLine = todo.rawLine || '',
                  indentWidth = Markdown.getIndentWidth ( rawLine, indentUnit );
            return Math.floor ( indentWidth / indentUnitLength );
          } ),
          minLevel = Math.min ( ...levels ),
          roots = [],
          stack = [{ level: -1, children: roots }];

    data.forEach ( ( todo, index ) => {

      const level = Math.max ( 0, levels[index] - minLevel ),
            node = Object.assign ( {}, todo, { children: [] } );

      while ( stack.length > 1 && level <= stack[stack.length - 1].level ) {
        stack.pop ();
      }

      stack[stack.length - 1].children.push ( node );
      stack.push ({ level, children: node.children });

    });

    return roots;

  }

}

type TodoDataArray = Array<any> & {
  sectionGrouped?: boolean;
  fromNested?: boolean;
};

/* EXPORT */

export default new Embedded ();
