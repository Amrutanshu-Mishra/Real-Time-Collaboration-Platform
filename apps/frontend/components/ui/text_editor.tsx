'use client'

import { useEffect, useRef } from "react"
import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import * as Y from "yjs"

import { Toggle } from "@/components/ui/toggle"
import { useEditorState } from "@tiptap/react"
import { BoldIcon, ItalicIcon, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote } from "lucide-react"

const doc = new Y.Doc()

interface TiptapProps {
     onPresenceMessage?: (data: string) => void
}

export default function Tiptap({ onPresenceMessage }: TiptapProps) {

     const socketRef = useRef<WebSocket | null>(null)

     useEffect(() => {

          const socket = new WebSocket("ws://localhost:8080")
          socketRef.current = socket

          socket.onopen = () => {
               console.log("Connected to WebSocket server")
          }

          socket.onmessage = async (event) => {

               // ── Text (JSON) messages → presence ──
               if (typeof event.data === 'string') {
                    onPresenceMessage?.(event.data)
                    return
               }

               // ── Binary messages → Yjs updates ──
               let update: Uint8Array | undefined

               if (event.data instanceof Blob) {
                    const buffer = await event.data.arrayBuffer()
                    update = new Uint8Array(buffer)
               } else if (event.data instanceof ArrayBuffer) {
                    update = new Uint8Array(event.data)
               }

               if (update) {
                    Y.applyUpdate(doc, update)
               }
          }

          socket.onclose = () => {
               console.log("Disconnected from WebSocket server")
          }

          doc.on("update", (update: Uint8Array) => {
               if (socket.readyState === WebSocket.OPEN) {
                    socket.send(update)
               }
          })

          return () => {
               socket.close()
          }

     }, [onPresenceMessage])

     const editor = useEditor({
          extensions: [
               StarterKit,
               Collaboration.configure({
                    document: doc,
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
          immediatelyRender: false
     })

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