import type { Application } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { createServer } from 'http';
import { loadSelectors } from './config.js';
import { isLicenseValidForDataDir } from './license.js';
import { CDPBridge } from './cdp-bridge.js';
import { DOMExtractor } from './dom-extractor.js';
import { CommandExecutor } from './command-executor.js';
import { StateManager } from './state-manager.js';
import { WindowMonitor } from './window-monitor.js';
import { Relay } from './relay.js';
import type { ServerConfig } from './types.js';

export type EmbeddedParentHandles = {
  app: Application;
  httpServer: ReturnType<typeof createServer>;
  io: SocketServer;
};

interface EmbeddedEntry {
  relay: Relay;
  cdpBridge: CDPBridge;
  windowMonitor: WindowMonitor;
  extractor: DOMExtractor;
}

const embedded = new Map<string, EmbeddedEntry>();

let parentSnapshot: ServerConfig | null = null;
let getParentHandles: (() => EmbeddedParentHandles) | null = null;

export function registerEmbeddedRelayParentConfig(
  config: ServerConfig,
  getHandles?: () => EmbeddedParentHandles
): void {
  parentSnapshot = config;
  getParentHandles = getHandles ?? null;
}

export function isEmbeddedRelayRunning(name: string): boolean {
  return embedded.has(name);
}

export async function startEmbeddedRelaySession(
  name: string,
  cdpPort: number,
  dataDirAbs: string
): Promise<void> {
  if (!parentSnapshot || !getParentHandles) {
    throw new Error('Embedded relay: parent HTTP/socket handles not registered');
  }
  if (embedded.has(name)) {
    return;
  }

  if (!isLicenseValidForDataDir(dataDirAbs)) {
    throw new Error('Invalid or missing license in session data directory');
  }

  const { app, httpServer, io } = getParentHandles();

  const config: ServerConfig = {
    ...parentSnapshot,
    cdpUrl: `http://127.0.0.1:${cdpPort}`,
    serverPort: parentSnapshot.serverPort,
    serverHost: parentSnapshot.serverHost,
    dataDir: dataDirAbs,
    telegram: {
      enabled: false,
      botToken: '',
      preRegisteredUsers: [],
      impl: parentSnapshot.telegram.impl,
    },
  };

  const selectors = loadSelectors(config);
  const stateManager = new StateManager(config.debounceMs);
  const commandExecutor = new CommandExecutor(selectors);
  const cdpBridge = new CDPBridge(config);
  const extractor = new DOMExtractor(
    selectors,
    (state, errorMessage) => {
      if (state) stateManager.onExtraction(state);
      else stateManager.onExtractionFailure(errorMessage ?? 'Extraction failed');
    },
    () => cdpBridge.windows.find(w => w.id === cdpBridge.activeTargetId)?.title ?? ''
  );
  const windowMonitor = new WindowMonitor(cdpBridge, stateManager, extractor, config, selectors);

  cdpBridge.on('connected', () => {
    const client = cdpBridge.getClient();
    stateManager.onConnectionChanged(true);
    stateManager.updateWindows(cdpBridge.windows, cdpBridge.activeTargetId);
    commandExecutor.setClient(client);
    if (client) {
      extractor.start(client, config.pollIntervalMs);
    }
  });

  cdpBridge.on('disconnected', () => {
    stateManager.onConnectionChanged(false);
    commandExecutor.setClient(null);
    extractor.stop();
  });

  cdpBridge.on('error', (err: Error) => {
    console.error(`[embedded:${name}] CDP error: ${err.message}`);
  });

  const mountPath = '/s/' + name;
  const socketNamespace = '/relay-' + name;

  const relay = new Relay(config, stateManager, commandExecutor, cdpBridge, {
    enableLauncherApi: false,
    parent: { app, httpServer, io },
    mountPath,
    socketNamespace,
  });

  await relay.start();
  await cdpBridge.connect();
  windowMonitor.start();

  embedded.set(name, { relay, cdpBridge, windowMonitor, extractor });
}

export async function stopEmbeddedRelaySession(name: string): Promise<void> {
  const e = embedded.get(name);
  if (!e) return;
  e.windowMonitor.stop();
  e.extractor.stop();
  await e.cdpBridge.disconnect();
  await e.relay.stop();
  embedded.delete(name);
}

export async function stopAllEmbeddedRelaySessions(): Promise<void> {
  for (const n of [...embedded.keys()]) {
    await stopEmbeddedRelaySession(n);
  }
}
