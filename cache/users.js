const { promisify } = require("util");


// Join user to chat
async function userJoin({ socketId, username, room }, client) {
  // new Joined user
  const user = { socketId, username, room }
  const userStr = JSON.stringify(user);

  const roomUsers = await getRoomUsers(room, client) || [];

  roomUsers.push({socketId, room, username });

  const roomUsersStr = JSON.stringify(roomUsers);

  const hsetAsync = promisify(client.hset).bind(client);

  const userResult = await hsetAsync('chatting_users', socketId, userStr)
  const roomResult = await hsetAsync('room_users', room, roomUsersStr)


  console.log('userJoin status', userResult);
  console.log('roomUser status', roomResult);

  return user;
}

// Get current user
async function getCurrentUser(socketId, client) {
  const hgetAsync = promisify(client.hget).bind(client);
  let curUser = await hgetAsync('chatting_users', socketId);

  return JSON.parse(curUser);
}

async function getRoomUsers(room, client) {
  const hgetAsync = promisify(client.hget).bind(client);
  
  let roomUsers = await hgetAsync('room_users', room);

  return JSON.parse(roomUsers)
}

async function userLeave(socketId, client) {
  const hdelAsync = promisify(client.hdel).bind(client);
  const hsetAsync = promisify(client.hset).bind(client);

  const curUser = await getCurrentUser(socketId, client);

  if (!curUser) {
    return;
  }
  const roomUsers = await getRoomUsers(curUser.room, client);
  // console.log('roomuser', roomUsers)
  const index = roomUsers.findIndex(user => user.socketId === socketId);
  
  if (index !== -1) {
    let leaveUser = roomUsers.splice(index, 1)[0];
    let roomUsersStr = JSON.stringify(roomUsers);

    await hdelAsync('chatting_users', socketId);
    await hsetAsync('room_users', curUser.room, roomUsersStr);
  
    return leaveUser;
  }

  // TODO: user don't exist
}

module.exports = {
  userJoin,
  getCurrentUser,
  getRoomUsers,
  userLeave
}