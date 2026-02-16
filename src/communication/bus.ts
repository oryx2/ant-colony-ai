import { EventEmitter } from 'events';
import type { AgentMessage } from '../config.js';

// 消息总线 - 模拟蚁穴中的化学信号和触角接触
export class MessageBus extends EventEmitter {
  private static instance: MessageBus;
  private messageHistory: AgentMessage[] = [];
  private maxHistory = 1000;

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  // 发送消息（直接通讯）
  send(message: AgentMessage): void {
    this.messageHistory.push(message);
    
    // 限制历史大小
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    if (message.to) {
      // 点对点
      this.emit(`to:${message.to}`, message);
    } else {
      // 广播
      this.emit('broadcast', message);
    }
    
    // 也触发发送者事件（用于日志）
    this.emit('message', message);
  }

  // 订阅特定接收者的消息
  onMessage(to: string, handler: (msg: AgentMessage) => void): void {
    this.on(`to:${to}`, handler);
  }

  // 订阅广播
  onBroadcast(handler: (msg: AgentMessage) => void): void {
    this.on('broadcast', handler);
  }

  // 获取最近的消息
  getRecentMessages(count = 10, filter?: { from?: string; to?: string; type?: string }): AgentMessage[] {
    let messages = [...this.messageHistory];
    
    if (filter?.from) {
      messages = messages.filter(m => m.from === filter.from);
    }
    if (filter?.to) {
      messages = messages.filter(m => m.to === filter.to);
    }
    if (filter?.type) {
      messages = messages.filter(m => m.type === filter.type);
    }
    
    return messages.slice(-count);
  }

  // 等待特定消息
  waitForMessage(predicate: (msg: AgentMessage) => boolean, timeout = 5000): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('message', handler);
        reject(new Error('Message wait timeout'));
      }, timeout);

      const handler = (msg: AgentMessage) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          this.off('message', handler);
          resolve(msg);
        }
      };

      this.on('message', handler);
    });
  }

  clear(): void {
    this.messageHistory = [];
    this.removeAllListeners();
  }
}

export const bus = MessageBus.getInstance();
