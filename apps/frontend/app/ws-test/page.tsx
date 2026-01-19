//Since we are testing the flow when a client connects to our websocket server this is a client side page
"use client";

import React, { useEffect, useState } from "react";

const WebSocketClient = () => {
     const [messages, setMessages] = useState<string[]>([]);
     const [input, setInput] = useState('');
     const [ws, setWs] = useState<WebSocket | null>(null);

     useEffect(() => {
          const socket = new WebSocket('ws://localhost:8080');

          socket.onopen = () => {
               console.log('Connected to websocket server');
               setWs(socket);
          };

          socket.onmessage = async (data) => {
               console.log(data);
          };

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
          if (ws && ws.readyState === WebSocket.OPEN) {
               ws.send(input);
               setMessages((prevMessages) => [...prevMessages, `Sent: ${input}`]);
               setInput('');
          }
          else{
               console.log('WebSocket is not connected');
          }
     }

     return (
          <div>
               Web socket server testing
               <input
                    type="text"
                    value={input}
                    onChange={(e)=> setInput(e.target.value)}
                    placeholder="Send a message"
               />
               <button onClick={sendMessage}>
                    Click Me
               </button>
               <div>
                    <h2>Messages:</h2>
                    <ul>
                         {messages.map((msg,index) => (
                              <li key={index}>{msg}</li>
                         ))}
                    </ul>
               </div>
          </div>
     )
};

export default WebSocketClient