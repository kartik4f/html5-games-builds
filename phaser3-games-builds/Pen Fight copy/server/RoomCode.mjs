//==================================================
// RoomCode.mjs
//==================================================
// Short, easy-to-read-aloud-to-a-friend room codes. Excludes
// characters that are easy to mix up (0/O, 1/I/L).
//==================================================

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 4;

export function generateRoomCode(existingRooms) {
  let code;

  do {
    code = randomCode();
  } while (existingRooms.has(code));

  return code;
}

function randomCode() {
  let code = '';

  for (let i = 0; i < LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  return code;
}
