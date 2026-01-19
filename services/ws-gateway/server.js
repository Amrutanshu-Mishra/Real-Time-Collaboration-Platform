import WebSocket, {WebSocketServer} from "ws";

const wss = new WebSocketServer({port: 8080});

wss.on('connection', function connection(ws) {
  ws.send('client connected');
  console.log("client has been connected");

  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.on('close', function disconnection(){
    console.log('client disconnected');
  })
  
});

