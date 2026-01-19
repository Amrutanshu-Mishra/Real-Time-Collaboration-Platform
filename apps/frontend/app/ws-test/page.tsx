//Since we are testing the flow when a client connects to our websocket server this is a client side page
"use client";

import React, { useEffect, useState } from "react";

const WebSocketClient = () => {
     const [messages, setMessages] = useState([]);
     const [input, setInput] = useState('');
     const [ws, setWs] = useState<WebSocket | null>(null);

     useEffect(() => {
          const socket = new WebSocket('ws://localhost:8080');

          socket.onopen = () => {
               console.log('Connected to websocket server');
               setWs(socket);
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

     return(
          <div>
               Web socket server testing
          </div>
     )
};

export default WebSocketClient