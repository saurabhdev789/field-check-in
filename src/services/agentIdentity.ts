import {localStorage} from './localStorage';

const AGENT_ID_KEY = 'field-check-in.agent-id.v1';

function createUuid() {
  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] % 16) + 64;
  bytes[8] = (bytes[8] % 64) + 128;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export async function getAgentId() {
  const existing = await localStorage.getString(AGENT_ID_KEY);

  if (existing) {
    return existing;
  }

  const agentId = `agent-${createUuid()}`;
  await localStorage.set(AGENT_ID_KEY, agentId);
  return agentId;
}
