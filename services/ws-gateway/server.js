import WebSocket, {WebSocketServer} from "ws";

const wss = new WebSocketServer({port: 8080});

//Data structure to hold all connected clients

wss.on('connection', function connection(ws) {
  //add clients whenever they are added

  ws.send('client connected');
  console.log("client has been connected");

  ws.on('message', function message(data, isBinary) {
    console.log('received: %s', data);
    wss.clients.forEach((client) =>{
      if(client.readyState === WebSocket.OPEN){
        client.send(data, {binary:isBinary});
      }
    });
  });

  ws.on('close', function disconnection(){
    console.log('client disconnected');
  })
  
});

