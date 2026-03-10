'use client'

import { useEffect, useRef, useMemo } from "react"
import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import { CollaborationCursorExtension } from "@/lib/CollaborationCursorExtension"
import * as Y from "yjs"
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness"

import { Toggle } from "@/components/ui/toggle"
import { useEditorState } from "@tiptap/react"
import { BoldIcon, ItalicIcon, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote } from "lucide-react"
import type { UserInfo } from "@/hooks/usePresence"

interface TiptapProps {
     docId: string
     onPresenceMessage?: (data: string) => void
     currentUser?: UserInfo | null
}

export default function Tiptap({ docId, onPresenceMessage, currentUser }: TiptapProps) {

     const socketRef = useRef<WebSocket | null>(null)

     // Create a per-document Y.Doc and Awareness, keyed by docId.
     // useMemo ensures the same doc/awareness are used across renders for the same docId,
     // and new ones are created when docId changes.
     const { doc, awareness } = useMemo(() => {
          const ydoc = new Y.Doc()
          const yAwareness = new Awareness(ydoc)
          return { doc: ydoc, awareness: yAwareness }
     }, [docId])

     useEffect(() => {
          // Include docId as a query parameter so the server can assign us to the correct room
          const socket = new WebSocket(`ws://localhost:8080?docId=${encodeURIComponent(docId)}`)
          socketRef.current = socket

          socket.onopen = () => {
               console.log(`Connected to room "${docId}"`)
          }

          socket.onmessage = async (event) => {

               // ── Text (JSON) messages → presence ──
               if (typeof event.data === 'string') {
                    onPresenceMessage?.(event.data)
                    return
               }

               // ── Binary messages → Yjs doc/awareness updates ──
               let buffer: ArrayBuffer | undefined

               if (event.data instanceof Blob) {
                    buffer = await event.data.arrayBuffer()
               } else if (event.data instanceof ArrayBuffer) {
                    buffer = event.data
               }

               if (buffer) {
                    const update = new Uint8Array(buffer)
                    if (update.length === 0) return

                    const messageType = update[0]
                    const payload = new Uint8Array(buffer, 1) // slice off header byte

                    if (messageType === 0) {
                         // Doc update
                         Y.applyUpdate(doc, payload)
                    } else if (messageType === 1) {
                         // Awareness update
                         applyAwarenessUpdate(awareness, payload, socket)
                    }
               }
          }

          socket.onclose = () => {
               console.log(`Disconnected from room "${docId}"`)
          }

          const handleDocUpdate = (update: Uint8Array) => {
               if (socket.readyState === WebSocket.OPEN) {
                    const message = new Uint8Array(update.length + 1)
                    message[0] = 0 // type 0 = doc update
                    message.set(update, 1)
                    socket.send(message)
               }
          }

          const handleAwarenessUpdate = ({ added, updated, removed }: any, origin: any) => {
               // Don't bounce messages back right after receiving them from the server
               if (origin === socket) return

               if (socket.readyState === WebSocket.OPEN) {
                    const changedClients = added.concat(updated).concat(removed)
                    const update = encodeAwarenessUpdate(awareness, changedClients)
                    const message = new Uint8Array(update.length + 1)
                    message[0] = 1 // type 1 = awareness update
                    message.set(update, 1)
                    socket.send(message)
               }
          }

          doc.on("update", handleDocUpdate)
          awareness.on("update", handleAwarenessUpdate)

          return () => {
               doc.off("update", handleDocUpdate)
               awareness.off("update", handleAwarenessUpdate)
               awareness.setLocalState(null) // remove self from awareness on disconnect
               socket.close()
          }

     }, [doc, awareness, docId, onPresenceMessage])

     const editor = useEditor({
          extensions: [
               // undoRedo MUST be disabled — Collaboration provides its own Yjs-based undo manager
               StarterKit.configure({ undoRedo: false }),
               Collaboration.configure({
                    document: doc,
               }),
               // Use the local extension that imports yCursorPlugin from @tiptap/y-tiptap
               // (same package as Collaboration), ensuring both share the same ySyncPluginKey.
               // The official @tiptap/extension-collaboration-cursor uses y-prosemirror
               // which has a separate PluginKey instance — causing the 'reading doc' crash.
               CollaborationCursorExtension.configure({
                    provider: { awareness } as any,
                    user: {
                         name: currentUser?.name ?? 'Anonymous',
                         color: currentUser?.color ?? '#6366f1',
                    },
               }),
          ],

          content: `
      <h1>Welcome to SyncOrbit</h1>
      <p>Start collaborating in real-time.</p>
    `,
          editorProps: {
               attributes: {
                    class: "prose prose-lg max-w-none focus:outline-none min-h-[500px] px-8 py-6"
               }
          },
          immediatelyRender: false,
     }, [doc, awareness])

     // Keep the awareness user metadata in sync when currentUser changes after initial mount
     useEffect(() => {
          if (editor && currentUser) {
               editor.commands.updateUser({ name: currentUser.name, color: currentUser.color })
          }
     }, [editor, currentUser])

     return (
          <div className="flex flex-col w-full max-w-4xl mx-auto my-8">
               {editor && (
                    <div className="sticky top-20 z-10 mx-auto mb-4">
                         <ToolBar editor={editor} />
                    </div>
               )}
               <div className="border rounded-xl overflow-hidden">
                    <EditorContent editor={editor} />
               </div>
          </div>
     )
}

function ToolBar({ editor }: { editor: Editor }) {

     const editorState = useEditorState({
          editor,
          selector: (ctx) => ({
               isBold: ctx.editor.isActive("bold"),
               isItalic: ctx.editor.isActive("italic"),
               isStrike: ctx.editor.isActive("strike"),
               isH1: ctx.editor.isActive("heading", { level: 1 }),
               isH2: ctx.editor.isActive("heading", { level: 2 }),
               isBulletList: ctx.editor.isActive("bulletList"),
               isOrderedList: ctx.editor.isActive("orderedList"),
               isBlockquote: ctx.editor.isActive("blockquote"),
          })
     })

     return (
          <div className="flex items-center gap-1 p-1.5 rounded-full border shadow-sm">

               <Toggle
                    size="sm"
                    pressed={editorState.isBold}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
               >
                    <BoldIcon className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isItalic}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
               >
                    <ItalicIcon className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isStrike}
                    onPressedChange={() => editor.chain().focus().toggleStrike().run()}
               >
                    <Strikethrough className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isH1}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
               >
                    <Heading1 className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isH2}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
               >
                    <Heading2 className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isBulletList}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
               >
                    <List className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isOrderedList}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
               >
                    <ListOrdered className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isBlockquote}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
               >
                    <Quote className="h-4 w-4" />
               </Toggle>

          </div>
     )
}