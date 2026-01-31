'use client'

import { useEditor, EditorContent, Editor, useEditorState } from '@tiptap/react'
import { Toggle } from "@/components/ui/toggle"
import StarterKit from '@tiptap/starter-kit'
import { BoldIcon, ItalicIcon, UnderlineIcon, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

const doc = new Y.Doc() // Initialize Y.Doc for shared editing



const Tiptap = () => {
     // const [messages, setMessages] = useState<string[]>([]);
     // const WebSocketClient = () => {
          const decoder = new TextDecoder('utf-8');
          const [messages, setMessages] = useState<string[]>([]);
          const [input, setInput] = useState('');
          const [ws, setWs] = useState<WebSocket | null>(null);

          var input_for_test=new Uint8Array();

          const socket = new WebSocket('ws://localhost:8080');
          useEffect(() => {

               socket.onopen = () => {
                    console.log('Connected to websocket server');
                    setWs(socket);
               };

               socket.onmessage = async (data_from_server) => {
                    var data=data_from_server.data;
                    if(data instanceof Blob){
                         const convertedData = await data.arrayBuffer();
                         const newData = new Uint8Array(convertedData);
                         console.log(newData);
                         Y.applyUpdate(doc, newData);
                    }
                    else{
                         console.log(data);
                    }
               };
               doc.on('update', (update, origin) => {
                    const newUpdate = decoder.decode(update);
                    console.log(update);
                    input_for_test=new Uint8Array(update);
                    setInput(newUpdate);
                    console.log(input);

                    console.log('Document update(binary)', newUpdate);
                    sendMessage();
               });
               socket.onclose = () => {
                    console.log('Disconnected from websocket server');
               }

               // Clean up the connection when the component unmounts
               return () => {
                    if (socket.readyState === 1) {
                         socket.close();
                    }
               }
          }, []);

          const sendMessage = () => {
               if (socket && socket.readyState === WebSocket.OPEN) {
                    console.log("On here ", input_for_test);
                    
                    socket.send(input_for_test);
                    setMessages((prevMessages) => [...prevMessages, `Sent: ${input_for_test}`]);
                    setInput('');
               }
               else {
                    console.log('WebSocket is not connected');
               }
          }
     // };

     const editor = useEditor({
          extensions: [
               StarterKit,
               Collaboration.configure({
                    document: doc, // Configure Y.Doc for collaboration
               }),
          ],
          content: `
            <h1>Welcome to SyncOrbit</h1>
            <p>Start collaborating in real-time. This is a premium editor experience.</p>
            <p>Try selecting text to see the formatting options.</p>
          `,
          editorProps: {
               attributes: {
                    class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
               },
          },
          immediatelyRender: false,
     });


     return (
          <div className="flex flex-col w-full max-w-4xl mx-auto my-8">
               {editor && (
                    <div className="sticky top-20 z-10 mx-auto mb-4 transition-all duration-300">
                         <ToolBar editor={editor} />
                    </div>
               )}
               <div className="relative min-h-150 w-full bg-background border rounded-xl overflow-hidden">
                    <EditorContent editor={editor} />
               </div>
          </div>
     )
}


export default Tiptap;


const ToolBar = ({ editor }: { editor: Editor }) => {

     const editorState = useEditorState({
          editor, selector: (ctx) => {
               return {
                    isBold: ctx.editor.isActive("bold"),
                    isItalic: ctx.editor.isActive("italic"),
                    isStrike: ctx.editor.isActive("strike"),
                    isH1: ctx.editor.isActive("heading", { level: 1 }),
                    isH2: ctx.editor.isActive("heading", { level: 2 }),
                    isBulletList: ctx.editor.isActive("bulletList"),
                    isOrderedList: ctx.editor.isActive("orderedList"),
                    isBlockquote: ctx.editor.isActive("blockquote"),
               }
          }
     })
     return (
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl shadow-black/10">
               <Toggle
                    size="sm"
                    pressed={editorState.isBold}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                    aria-label="Toggle bold"
                    className="rounded-full"
               >
                    <BoldIcon className="h-4 w-4" />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isItalic}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                    aria-label='Toggle Italic'
                    className="rounded-full"
               >
                    <ItalicIcon className='h-4 w-4' />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isStrike}
                    onPressedChange={() => editor.chain().focus().toggleStrike().run()}
                    aria-label='Toggle Strikethrough'
                    className="rounded-full"
               >
                    <Strikethrough className='h-4 w-4' />
               </Toggle>

               <div className="w-px h-4 bg-border mx-1" />

               <Toggle
                    size="sm"
                    pressed={editorState.isH1}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    aria-label='Heading 1'
                    className="rounded-full"
               >
                    <Heading1 className='h-4 w-4' />
               </Toggle>
               <Toggle
                    size="sm"
                    pressed={editorState.isH2}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    aria-label='Heading 2'
                    className="rounded-full"
               >
                    <Heading2 className='h-4 w-4' />
               </Toggle>

               <div className="w-px h-4 bg-border mx-1" />

               <Toggle
                    size="sm"
                    pressed={editorState.isBulletList}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                    aria-label='Bullet List'
                    className="rounded-full"
               >
                    <List className='h-4 w-4' />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isOrderedList}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                    aria-label='Ordered List'
                    className="rounded-full"
               >
                    <ListOrdered className='h-4 w-4' />
               </Toggle>

               <Toggle
                    size="sm"
                    pressed={editorState.isBlockquote}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                    aria-label='Blockquote'
                    className="rounded-full"
               >
                    <Quote className='h-4 w-4' />
               </Toggle>
          </div>
     )
}