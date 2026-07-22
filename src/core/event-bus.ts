/**
 * Type-safe Event Bus.
 * Central communication channel between game systems.
 * Wraps Phaser's EventEmitter with typed payloads.
 */

import { EventPayloads, GameEvent } from '@/types/events';

type EventCallback<T extends GameEvent> = (payload: EventPayloads[T]) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback<GameEvent>>> = new Map();

  /**
   * Subscribe to an event.
   */
  on<T extends GameEvent>(event: T, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<GameEvent>);
  }

  /**
   * Unsubscribe from an event.
   */
  off<T extends GameEvent>(event: T, callback: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<GameEvent>);
    }
  }

  /**
   * Emit an event with payload.
   */
  emit<T extends GameEvent>(event: T, payload: EventPayloads[T]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const callback of set) {
        callback(payload);
      }
    }
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first call.
   */
  once<T extends GameEvent>(event: T, callback: EventCallback<T>): void {
    const wrapper: EventCallback<T> = (payload) => {
      this.off(event, wrapper);
      callback(payload);
    };
    this.on(event, wrapper);
  }

  /**
   * Remove all listeners. Call on game shutdown.
   */
  destroy(): void {
    this.listeners.clear();
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus();
