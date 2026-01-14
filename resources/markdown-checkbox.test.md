# Markdown Checkbox Embedded Todos

This file is a focused test set for markdown task list detection in embedded todos.

## Basic

- [ ] task one
- [ ] task two with text
- [ ] task with @tag and TODO keyword
- [ ] TODO: task with colon
- [ ] FIXME task inline

## Indentation

- [ ] indented task
  - [ ] nested task
    - [ ] tab-indented task

## Mixed lines

- [ ] task followed by TODO: and text
- [ ] task then @started(2026-01-01)

## Title and nested title

- [ ] task A
- [ ] task B

### H3 level

- [ ] task from H3 title
  - [ ] nested task from H3 title

## Edge cases

- [ ]
- [ ]
- [ ] 123
- [ ] task with brackets []
- [ ] task with markdown **bold** and _italic_

## Non-matches

- [x] completed task should not match if only open tasks are expected
- [X] completed task uppercase
- [ ]-not-a-task (missing space)
- [] missing space
- [ ] (no text)
