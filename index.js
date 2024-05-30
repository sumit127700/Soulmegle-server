const express = require("express");
const app = express();
const server = require("http").createServer(app);
const cors = require("cors");
const similarityAlgo = require("./utils/similarityAlgo.js");
const io = require("socket.io")(server, {
  cors: {
    origin: "https://soulmegle-client.vercel.app", // Allow requests from this origin
    methods: ["GET", "POST"], // Allow GET and POST requests
    allowedHeaders: ["Content-Type", "Authorization"], // Add any additional headers you want to allow
    credentials: true, // Allow sending cookies from the client
  },
});

// ... (other imports and setup)

app.use(
  cors({
    origin: "https://soulmegle-client.vercel.app", // Allow requests from this origin
    methods: ["GET", "POST"], // Allow GET and POST requests
    allowedHeaders: ["Content-Type", "Authorization"], // Add any additional headers you want to allow
    credentials: true, // Allow sending cookies from the client
  })
);

/*               Implementing Sockets                       */
/************************************************************/
/************************************************************/

const waitingClients = [];
const rooms = {};

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.emit("me", socket.id);
  socket.on("join", ({ embeddings }) => {
    console.log("User joined");
    while (1) {
      var index = -1;
      index = waitingClients.findIndex((client) => client.socket === socket);
      if (index === -1) break;
      waitingClients.splice(index, 1);
    }
    const matchedInd = similarityAlgo(embeddings, waitingClients);
    if (waitingClients.length > 0 && matchedInd !== -1) {
      const otherClient = waitingClients[matchedInd].socket;
      waitingClients.splice(matchedInd, 1);
      const roomId = `room-${Date.now()}`;
      socket.join(roomId);
      otherClient.join(roomId);
      rooms[roomId] = [socket, otherClient];
      console.log(`Created new room ${roomId} with two clients`);
      socket.emit("me", socket.id);
      otherClient.emit("me", otherClient.id);
      io.to(socket.id).emit("paired", {
        roomId: roomId,
        remoteSID: otherClient.id,
      });
      io.to(otherClient.id).emit("paired", {
        roomId: roomId,
        remoteSID: socket.id,
      });
      io.to(otherClient.id).emit("initiateCall", {
        remoteSID: socket.id,
      });
      console.log("call initiated");
    } else {
      waitingClients.push({ socket: socket, embeddings: embeddings });

      console.log("User added to waiting list");
    }
  });

  /*                Socket sends a message to server            */
  /**************************************************************/
  /**************************************************************/

  socket.on("message", (data) => {
    const { roomId, message } = data;
    const room = rooms[roomId];

    if (room) {
      // Broadcast the message to all clients in the room (except the sender)
      room.forEach((client) => {
        if (client !== socket)
          io.to(client.id).emit("message", { message, sender: socket.id });
      });
    } else {
      console.log("Room not found");
    }
  });
  socket.on("exitRoom", () => {
    console.log("exit Room called");
    Object.entries(rooms).forEach(([roomId, room]) => {
      const clientIndex = room.indexOf(socket);
      if (clientIndex !== -1) {
        rooms[roomId][1 - clientIndex].emit("roomClosed");
        console.log("room close emitted");
        delete rooms[roomId];
      }
    });
  });

  /** handle video call
   *
   *
   *
   *
   *
   *
   */
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit("callUser", { signal: signalData, from, name });
    console.log("calling user" + from);
  });
  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
    console.log("recieving call" + data.to);
  });
  /* 






*/

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected");

    // Remove the client from the waiting list if present
    const index = waitingClients.findIndex(
      (client) => client.socket === socket
    );
    if (index !== -1) {
      waitingClients.splice(index, 1);
      console.log("Removed user from waiting list");
    }

    // Remove the client from any room they were part of
    Object.entries(rooms).forEach(([roomId, room]) => {
      const clientIndex = room.indexOf(socket);
      if (clientIndex !== -1) {
        rooms[roomId][1 - clientIndex].emit("roomClosed");
        delete rooms[roomId];
      }
    });
  });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
