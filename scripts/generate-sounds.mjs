import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public", "sounds");
const sampleRate = 44_100;

mkdirSync(output, { recursive: true });

function envelope(time, duration, attack = 0.015, decayPower = 2.4) {
  const attackGain = Math.min(1, time / attack);
  return attackGain * Math.max(0, 1 - time / duration) ** decayPower;
}

function writeWave(name, duration, synth) {
  const sampleCount = Math.floor(sampleRate * duration);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const sample = Math.max(-1, Math.min(1, synth(time, duration)));
    buffer.writeInt16LE(Math.round(sample * 32_000), 44 + index * 2);
  }
  writeFileSync(resolve(output, `${name}.wav`), buffer);
}

writeWave("gentle", 1.2, (time, duration) => {
  const env = envelope(time, duration, 0.02, 2.8);
  return env * (0.42 * Math.sin(2 * Math.PI * 659.25 * time) + 0.18 * Math.sin(2 * Math.PI * 1318.5 * time));
});

writeWave("bright", 1.05, (time, duration) => {
  const second = time > 0.24 ? envelope(time - 0.24, duration - 0.24, 0.008, 3.1) : 0;
  const first = envelope(time, duration, 0.008, 3.6);
  return (
    0.36 * first * Math.sin(2 * Math.PI * 880 * time) + 0.34 * second * Math.sin(2 * Math.PI * 1174.66 * (time - 0.24))
  );
});

let seed = 73_421;
function noise() {
  seed = (seed * 48_271) % 2_147_483_647;
  return (seed / 2_147_483_647) * 2 - 1;
}

writeWave("wood", 0.72, (time, duration) => {
  const env = envelope(time, duration, 0.002, 5.2);
  const tone = Math.sin(2 * Math.PI * 246.94 * time) + 0.45 * Math.sin(2 * Math.PI * 493.88 * time);
  return env * (0.33 * tone + 0.08 * noise());
});

console.log(`Created 3 original sounds in ${output}`);
