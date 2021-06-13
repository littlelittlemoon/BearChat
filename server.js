const path  = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const formatMessage = require('./cache/messages');
const {
  userJoin, 
  getCurrentUser, 
  getRoomUsers, 
  userLeave 
} = require('./cache/users');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const redis = require('redis');
let client;

fs.readFile('creds.json', 'utf-8', (err, data) => {
  if (err) throw err;
  let creds = JSON.parse(data);
  client = redis.createClient(creds.port, creds.host, {detect_buffers: true});
  client.auth(creds.password, redis.print);
  client.on("error", function(error) {
    console.error(error);
  });

  // Redis Client Ready
  client.once('ready', function () {
    // clear cache when restart app
    client.del(['chatting_users', 'room_users', 'chat_messages']);
  });

});

const robotName = 'Bear Bot';

// Set static folder
app.use(express.static(path.join(__dirname, 'public')))

// Run when client connects 
io.on('connection', socket => {
  // Li
  socket.on('joinRoom', ({ username, room }) => {
    userJoin({ socketId: socket.id, username, room }, client).then((user) => {

      socket.join(user.room)
      socket.emit('loginedUser', user.username);
      // Welcome current user
      formatMessage({ 
        room: user.room, 
        username: robotName, 
        text: 'Welcome to BearChar, have fun! :)'
      }, client).then((msg) => {
        socket.emit('message', msg);
      }).then(() => {
        formatMessage({ 
          room: user.room, 
          username: robotName, 
          text: `${user.username} has joined the chat!`
        }, client).then((broadMsg) => {
          // Broadcast when a user connects // or io.emit()
          socket.broadcast.to(user.room).emit('message', broadMsg);
        })
      });
      
      // Send users and room infomation
      console.log('getRoomUsers', user)
      getRoomUsers(user.room, client).then((users) => {
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users
        });
      })
    });

  });
  
  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    getCurrentUser(socket.id, client).then((user) => {
      console.log('current user info:', user);
      if (user) {
        return formatMessage({
          room: user.room, 
          username: user.username, 
          text: msg
        }, client).then((msg) => {
          io.to(user.room).emit('message', msg);
        });
      } 
      console.log('Session expired!');
      // TODO: relogin
      userLeave(socket.id, client).then((user) => {
        if (!user) {
          return;
        }
        formatMessage({
          room: user.room, 
          username: robotName, 
          text: `${user.username} has left the chat!`
        }, client).then((msg) => {
          io.to(user.room).emit('message', msg);
        });
        
        getRoomUsers(user.room, client).then((users) => {
          // Send users and room infomation
          io.to(user.room).emit('roomUsers', {
            room: user.room,
            users
          });
        });
      });
    });
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    userLeave(socket.id, client).then((user) => {
      if (!user) {
        return;
      }

      formatMessage({
        room: user.room, 
        username: robotName, 
        text: `${user.username} has left the chat!`
      }, client).then((msg) => {
        io.to(user.room).emit('message', msg);
      });
      
      getRoomUsers(user.room, client).then((users) => {
        // Send users and room infomation
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users
        });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});