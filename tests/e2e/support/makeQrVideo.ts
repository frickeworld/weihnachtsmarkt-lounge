// Playwright-globalSetup: erzeugt eine Y4M-Datei im Temp-Ordner als Fake-Kamera (zeigt einen QR-Code mit Test-Token).
import QRCode from 'qrcode';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const QR_TOKEN = 'QrE2eTokenAbcdefghijkLMNOPqrstuv';
export const QR_VIDEO = join(tmpdir(), 'lounge-e2e-qr.y4m');

export default async function makeQrVideo() {
  const TOKEN = QR_TOKEN;
  const W = 640;
  const H = 480;
  const qr = await QRCode.toBuffer(TOKEN, { width: 300, margin: 4, errorCorrectionLevel: 'H' });
  const { data, info } = await sharp({
    create: { width: W, height: H, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: qr, gravity: 'center' }])
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const y = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) y[i] = data[i * info.channels]!;
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv, uv]);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F5:1 Ip A1:1 C420jpeg\n`);
  await writeFile(QR_VIDEO, Buffer.concat([header, frame]));
}
