/**
 * CRC-8 (poly 0x07, init 0x00) — computed at build time for every verified
 * link. The two-hex value shown on hover is the real checksum of the href;
 * nothing on this site fakes a reading.
 */
export function crc8(input: string): string {
  let crc = 0;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc.toString(16).padStart(2, '0');
}
