const { promisify } = require("util");
const moment = require('moment')

async function formatMessage({ room, username, text }, client) {
  const hsetAsync = promisify(client.hset).bind(client);


  let message = {
    username,
    text,
    time: moment().format('h:mm a')
  }

  let messageStr = JSON.stringify(message);

  const result = await hsetAsync('chat_messages', room, messageStr);
  console.log('chat message stored status:', result);

  return message
}

module.exports = formatMessage