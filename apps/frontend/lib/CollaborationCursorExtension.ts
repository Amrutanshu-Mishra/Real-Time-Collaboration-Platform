/**
 * Custom CollaborationCursor extension that imports yCursorPlugin from
 * @tiptap/y-tiptap instead of y-prosemirror.
 *
 * WHY: @tiptap/extension-collaboration uses @tiptap/y-tiptap (a Tiptap fork of
 * y-prosemirror). Both packages create their own `new PluginKey('y-sync')` at
 * module initialisation time. JavaScript PluginKey equality is by reference, not
 * by name string, so the cursor plugin from y-prosemirror cannot find the sync
 * state that was registered under @tiptap/y-tiptap's key — causing the
 * "Cannot read properties of undefined (reading 'doc')" crash.
 *
 * Importing yCursorPlugin from @tiptap/y-tiptap ensures both plugins share the
 * exact same ySyncPluginKey instance.
 */

import { Extension } from '@tiptap/core'
import {
  yCursorPlugin,
  defaultSelectionBuilder,
  defaultCursorBuilder,
} from '@tiptap/y-tiptap'
import type { Awareness } from 'y-protocols/awareness'

export interface CollaborationCursorUser {
  name: string
  color: string
}

export interface CollaborationCursorOptions {
  provider: { awareness: Awareness }
  user: CollaborationCursorUser
  render?: (user: CollaborationCursorUser) => HTMLElement
}

export const CollaborationCursorExtension = Extension.create<CollaborationCursorOptions>({
  name: 'collaborationCursor',

  addOptions() {
    return {
      provider: null as any,
      user: { name: 'Anonymous', color: '#6366f1' },
      render: (user: CollaborationCursorUser) => {
        const cursor = document.createElement('span')
        cursor.classList.add('collaboration-cursor__caret')
        cursor.setAttribute('style', `border-color: ${user.color}`)

        const label = document.createElement('div')
        label.classList.add('collaboration-cursor__label')
        label.setAttribute('style', `background-color: ${user.color}`)
        label.insertBefore(document.createTextNode(user.name), null)

        cursor.insertBefore(label, null)
        return cursor
      },
    }
  },

  addStorage() {
    return { users: [] }
  },

  addCommands() {
    return {
      updateUser:
        (attributes: CollaborationCursorUser) =>
        () => {
          this.options.user = attributes
          this.options.provider.awareness.setLocalStateField('user', attributes)
          return true
        },
    } as any
  },

  addProseMirrorPlugins() {
    const { awareness } = this.options.provider
    const { user, render } = this.options

    // Set our own user data into awareness
    awareness.setLocalStateField('user', user)

    // Track all remote users for storage
    const updateUsers = () => {
      this.storage.users = Array.from(awareness.states.entries()).map(
        ([clientId, state]) => ({ clientId, ...state.user })
      )
    }
    awareness.on('update', updateUsers)
    updateUsers()

    return [
      yCursorPlugin(awareness, {
        cursorBuilder: render as any,
        selectionBuilder: defaultSelectionBuilder,
      }),
    ]
  },
})
