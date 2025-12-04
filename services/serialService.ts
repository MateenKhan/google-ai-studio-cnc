
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
  private rawWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = '';
  private onStatusUpdate: ((status: MachineStatus) => void) | null = null;
  private onLog: ((msg: string) => void) | null = null;
  private keepReading = false;
  private statusInterval: number | null = null;

  // Job Streaming State
  private jobQueue: string[] = [];
  private jobTotalLines = 0;
  private isJobRunning = false;
  private isPaused = false;
  private onJobProgress: ((current: number, total: number) => void) | null = null;
  private pendingLine: string | null = null;

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
        this.rawWriter = this.port.writable.getWriter();
      }
      
      // Start polling status
      this.statusInterval = window.setInterval(() => {
          if (!this.isJobRunning || this.jobQueue.length % 20 === 0) { // Poll less frequently during high traffic?
              this.send('?');
          }
      }, 200);

      return true;
    } catch (err) {
      console.error('Error connecting to serial port:', err);
      // Reset port if connection failed but port was selected
      if (this.port) {
          this.port = null;
      }
      throw err;
    }
  }

  async disconnect() {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.keepReading = false;
    this.isJobRunning = false;
    
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.rawWriter) {
      await this.rawWriter.close();
      this.rawWriter = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  async send(data: string) {
    if (!this.rawWriter) return;
    // GRBL expects \n or \r
    const cmd = data.endsWith('\n') ? data : data + '\n';
    // Manually encode to ensure we use the raw writer
    const encoded = new TextEncoder().encode(cmd);
    await this.rawWriter.write(encoded);
    if (this.onLog && data !== '?') this.onLog(`> ${data.trim()}`);
  }

  // Send a single byte (e.g., for Real-time commands like 0x85 Jog Cancel)
  async sendByte(val: number) {
      if (!this.rawWriter) return;
      await this.rawWriter.write(new Uint8Array([val]));
      if (this.onLog) this.onLog(`> [RT: 0x${val.toString(16).toUpperCase()}]`);
  }

  setCallbacks(onStatus: (s: MachineStatus) => void, onLog: (msg: string) => void) {
      this.onStatusUpdate = onStatus;
      this.onLog = onLog;
  }

  // --- Job Control ---

  startJob(gcode: string, onProgress: (current: number, total: number) => void) {
      if (this.isJobRunning) return;
      
      // Filter empty lines and comments
      this.jobQueue = gcode.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('('));
      
      this.jobTotalLines = this.jobQueue.length;
      this.onJobProgress = onProgress;
      this.isJobRunning = true;
      this.isPaused = false;
      this.pendingLine = null;
      
      this.onLog?.('Starting Job...');
      this.sendNextLine();
  }

  pauseJob() {
      if (!this.isJobRunning) return;
      this.isPaused = !this.isPaused;
      // '!' is Feed Hold, '~' is Cycle Start
      this.sendByte(this.isPaused ? 0x21 : 0x7E); 
      this.onLog?.(this.isPaused ? 'Job Paused' : 'Job Resumed');
      if (!this.isPaused) {
          this.sendNextLine(); // Try to resume queue if idle
      }
  }

  stopJob() {
      this.isJobRunning = false;
      this.jobQueue = [];
      this.pendingLine = null;
      this.sendByte(0x18); // Soft Reset (Ctrl-X)
      this.onLog?.('Job Stopped');
      if (this.onJobProgress) this.onJobProgress(0, this.jobTotalLines);
  }

  private sendNextLine() {
      if (!this.isJobRunning || this.isPaused || this.pendingLine) return;

      if (this.jobQueue.length === 0) {
          this.isJobRunning = false;
          this.onLog?.('Job Completed');
          if (this.onJobProgress) this.onJobProgress(this.jobTotalLines, this.jobTotalLines);
          return;
      }

      const line = this.jobQueue.shift();
      if (line) {
          this.pendingLine = line;
          this.send(line);
          const current = this.jobTotalLines - this.jobQueue.length;
          if (this.onJobProgress) this.onJobProgress(current, this.jobTotalLines);
      }
  }

  // --- Read Loop ---

  private async readLoop() {
    if (!this.port?.readable) return;
    
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
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
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      // Handle 'ok' response for streaming
      if (cleanLine === 'ok') {
          this.pendingLine = null;
          if (this.isJobRunning) {
              this.sendNextLine();
          }
      } 
      // Handle Errors
      else if (cleanLine.toLowerCase().startsWith('error')) {
          this.onLog?.(`ERROR: ${cleanLine}`);
          // Decide if we stop job on error. Usually safest to stop or pause.
          // For now, we log and try to continue (risky) or stop.
          // Let's just clear pending so queue continues, but user sees error.
          this.pendingLine = null; 
          if (this.isJobRunning) this.sendNextLine(); 
      }

      if (cleanLine.startsWith('<')) {
        this.parseStatus(cleanLine);
      } else {
        if (this.onLog) this.onLog(`< ${cleanLine}`);
      }
    }
  }

  private parseStatus(line: string) {
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
