
import { MachineStatus } from '../types';

// Web Serial API Type Definitions
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

declare global {
  interface Navigator {
    serial: {
      requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    }
  }
}

export class SerialService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private writer: WritableStreamDefaultWriter<string> | null = null;
  private buffer = '';
  private onStatusUpdate: ((status: MachineStatus) => void) | null = null;
  private onLog: ((msg: string) => void) | null = null;
  private keepReading = false;
  private statusInterval: number | null = null;

  async connect(baudRate: number = 115200) {
    if (!navigator.serial) {
      throw new Error('Web Serial API not supported');
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate });
      
      this.keepReading = true;
      this.readLoop();
      
      if (this.port.writable) {
        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(this.port.writable);
        this.writer = textEncoder.writable.getWriter();
      }
      
      // Start polling status
      this.statusInterval = window.setInterval(() => {
          this.send('?');
      }, 200);

      return true;
    } catch (err) {
      console.error('Error connecting to serial port:', err);
      throw err;
    }
  }

  async disconnect() {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.keepReading = false;
    
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  async send(data: string) {
    if (!this.writer) return;
    // GRBL expects \n or \r
    const cmd = data.endsWith('\n') ? data : data + '\n';
    await this.writer.write(cmd);
    if (this.onLog && data !== '?') this.onLog(`> ${data.trim()}`);
  }

  setCallbacks(onStatus: (s: MachineStatus) => void, onLog: (msg: string) => void) {
      this.onStatusUpdate = onStatus;
      this.onLog = onLog;
  }

  private async readLoop() {
    if (!this.port?.readable) return;
    
    // Pipe through TextDecoder to get strings
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          this.buffer += value;
          this.processBuffer();
        }
      }
    } catch (error) {
      console.error('Read loop error:', error);
    } finally {
      this.reader.releaseLock();
    }
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      if (cleanLine.startsWith('<')) {
        this.parseStatus(cleanLine);
      } else {
        if (this.onLog) this.onLog(`< ${cleanLine}`);
      }
    }
  }

  private parseStatus(line: string) {
      // Example: <Idle|MPos:0.000,0.000,0.000|FS:0,0>
      const content = line.replace('<', '').replace('>', '');
      const parts = content.split('|');
      const state = parts[0] as MachineStatus['state'];
      
      let pos = { x: '0.000', y: '0.000', z: '0.000' };
      let feed = '0';
      let spindle = '0';

      parts.slice(1).forEach(part => {
          if (part.startsWith('MPos:') || part.startsWith('WPos:')) {
              const coords = part.split(':')[1].split(',');
              pos = { x: coords[0], y: coords[1], z: coords[2] };
          }
          if (part.startsWith('FS:')) {
              const fs = part.split(':')[1].split(',');
              feed = fs[0];
              spindle = fs[1];
          }
      });

      if (this.onStatusUpdate) {
          this.onStatusUpdate({ state, pos, feed, spindle });
      }
  }
}

export const serialService = new SerialService();
